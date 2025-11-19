package backup

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"your.module/config-manager/internal/config"
)

type Service struct {
	cfg          config.Config
	backupDir    string
	mongodump    string
	mongorestore string
}

func New(cfg config.Config) *Service {
	backupDir := filepath.Join(".", "backups")
	os.MkdirAll(backupDir, 0755)

	return &Service{
		cfg:          cfg,
		backupDir:    backupDir,
		mongodump:    cfg.MongodumpPath,
		mongorestore: cfg.MongorestorePath,
	}
}

func (s *Service) CreateBackup(ctx context.Context, name string) (string, error) {
	if name == "" {
		name = fmt.Sprintf("backup-%d", time.Now().Unix())
	}

	archivePath := filepath.Join(s.backupDir, name+".archive")

	cmd := exec.CommandContext(ctx, s.mongodump,
		"--uri="+s.cfg.MongoURI+"/"+s.cfg.MongoDB,
		"--archive="+archivePath,
		"--gzip",
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("mongodump failed: %w, output: %s", err, string(output))
	}

	return archivePath, nil
}

func (s *Service) RestoreBackup(ctx context.Context, archivePath string) error {
	if _, err := os.Stat(archivePath); err != nil {
		return fmt.Errorf("backup file not found: %w", err)
	}

	// Create pre-restore backup
	preRestoreName := fmt.Sprintf("pre-restore-%d", time.Now().Unix())
	preRestorePath, err := s.CreateBackup(ctx, preRestoreName)
	if err != nil {
		return fmt.Errorf("failed to create pre-restore backup: %w", err)
	}

	fmt.Printf("Pre-restore backup created: %s\n", preRestorePath)

	cmd := exec.CommandContext(ctx, s.mongorestore,
		"--uri="+s.cfg.MongoURI+"/"+s.cfg.MongoDB,
		"--archive="+archivePath,
		"--gzip",
		"--drop",
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("mongorestore failed: %w, output: %s", err, string(output))
	}

	return nil
}

func (s *Service) ListBackups() ([]string, error) {
	entries, err := os.ReadDir(s.backupDir)
	if err != nil {
		return nil, err
	}

	var backups []string
	for _, entry := range entries {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".archive" {
			backups = append(backups, entry.Name())
		}
	}

	return backups, nil
}

func (s *Service) GetBackupPath(name string) string {
	if filepath.Ext(name) != ".archive" {
		name += ".archive"
	}
	return filepath.Join(s.backupDir, name)
}

func (s *Service) DeleteBackup(name string) error {
	path := s.GetBackupPath(name)
	return os.Remove(path)
}
