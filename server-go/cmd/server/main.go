package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	appcfg "your.module/config-manager/internal/config"
	apphttp "your.module/config-manager/internal/http"
	applog "your.module/config-manager/internal/logger"
	appmongo "your.module/config-manager/internal/mongo"
)

func main() {
	cfg := appcfg.Load()
	log := applog.New(applog.LogLevel(cfg.LogLevel))

	log.Info("Starting Configuration Manager Service",
		applog.String("port", cfg.ServerPort),
		applog.String("logLevel", cfg.LogLevel),
		applog.String("storageType", cfg.StorageType),
	)

	mc, disconnect := appmongo.Connect(cfg, log)
	defer disconnect(context.Background())

	engine := apphttp.NewRouter(cfg, log, mc)
	srv := &http.Server{
		Addr:    ":" + cfg.ServerPort,
		Handler: engine,
	}

	go func() {
		log.Info("HTTP server listening", applog.String("address", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Failed to start server", applog.Error(err))
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	log.Info("Shutting down server gracefully...")
	if err := srv.Shutdown(context.Background()); err != nil {
		log.Error("Server shutdown error", applog.Error(err))
	}
	log.Info("Server stopped")
	log.Sync()
}
