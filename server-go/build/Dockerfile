FROM golang:1.25 AS build
WORKDIR /app
ENV GOTOOLCHAIN=auto
COPY . .
RUN go build -o /bin/app ./cmd/server

# Final image
FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /tmp
# Use Docker's downloader (ADD) to fetch the tools tarball reliably
ADD https://fastdl.mongodb.org/tools/db/mongodb-database-tools-ubuntu2204-x86_64-100.9.4.tgz /tmp/tools.tgz
RUN tar -xzf /tmp/tools.tgz -C /tmp && \
    install -m 0755 /tmp/mongodb-database-tools-ubuntu2204-x86_64-100.9.4/bin/mongodump /usr/local/bin/mongodump && \
    install -m 0755 /tmp/mongodb-database-tools-ubuntu2204-x86_64-100.9.4/bin/mongorestore /usr/local/bin/mongorestore && \
    rm -rf /tmp/tools.tgz /tmp/mongodb-database-tools-ubuntu2204-x86_64-100.9.4

WORKDIR /app
COPY --from=build /bin/app /app/app
ENV BACKUP_BIN_MONGODUMP=/usr/local/bin/mongodump BACKUP_BIN_MONGORESTORE=/usr/local/bin/mongorestore
EXPOSE 3004
CMD ["/app/app"]