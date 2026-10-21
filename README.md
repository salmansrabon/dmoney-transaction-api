# DMoney Transaction API

REST API for DMoney, a mobile-money ledger system. It uses Node.js 24, Express, Sequelize and MySQL.

This guide shows how to build and run the API with Docker. You do not install Node.js or MySQL on your computer.

## What Docker starts

| Service | Container name | Purpose | Port on your computer |
|---|---|---|---|
| `mysql` | `dmoney-mysql` | MySQL 8.4 database `dmoneydb` | `3308` |
| `dmoney-api` | `dmoney-api` | Node.js 24 API | `5000` |

Docker keeps your data in two named volumes:

| Volume | Content |
|---|---|
| `dmoney-transaction-api_dmoney_mysql_data` | MySQL data |
| `dmoney-transaction-api_dmoney_uploads` | Uploaded files |

The data stays in the volumes when you stop the containers. The data stays when you remove the containers.

## Before you start

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. Start Docker Desktop. Wait until it shows that Docker is running.
3. Make sure that ports `5000` and `3308` are free on your computer.

## First-time setup

1. Clone the repository.

   ```bash
   git clone https://github.com/salmansrabon/dmoney-transaction-api.git
   ```

2. Go into the project folder.

   ```bash
   cd dmoney-transaction-api
   ```

3. Build the image and start the services.

   ```bash
   docker compose up -d --build
   ```

   The first run downloads the Node.js and MySQL images. It then installs the packages. This can take several minutes.

4. Check the services.

   ```bash
   docker compose ps
   ```

   Wait until `dmoney-mysql` shows `healthy`. Then `dmoney-api` shows `Up`. This takes about 30 seconds.

5. Test the API.

   ```bash
   curl -X POST http://localhost:5000/user/login \
     -H "Content-Type: application/json" \
     -H "X-AUTH-SECRET-KEY: ROADTOSDET" \
     -d '{"email":"admin@dmoney.com","password":"1234"}'
   ```

   The API returns `Login successful` and a token.

6. Open the API documentation in your browser.
   - User API: <http://localhost:5000/api-docs/user>
   - Transaction API: <http://localhost:5000/api-docs/transaction>

On the first start, the API creates the tables. It also inserts the accounts in the next table.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@dmoney.com` | `1234` |
| Agent | `salmansrabon+agent@gmail.com` | `1234` |
| Customer | `salmansrabon+customer1@gmail.com` | `1234` |
| Customer | `salmansrabon+customer2@gmail.com` | `1234` |
| Merchant | `salmansrabon+merchant@gmail.com` | `1234` |

## Daily commands

Run all commands in the project folder (the folder that contains `docker-compose.yml`).

| Task | Command | What it does |
|---|---|---|
| Build | `docker compose build` | Builds the API image. It does not start anything. |
| Up | `docker compose up -d` | Creates the containers and starts them in the background. |
| Build and up | `docker compose up -d --build` | Builds the image, then does `up`. |
| Stop | `docker compose stop` | Stops the containers. It keeps the containers and the data. |
| Start | `docker compose start` | Starts the stopped containers. It is fast. It does not build or install anything. |
| Down | `docker compose down` | Stops and removes the containers. It keeps the data volumes. |
| Status | `docker compose ps -a` | Shows the state of each service. |
| Logs | `docker compose logs -f dmoney-api` | Shows the API logs. Press `Ctrl+C` to stop the log view. |

Use `docker compose stop` and `docker compose start` for daily work. Use `docker compose down` and `docker compose up -d` when you want new containers. Both ways keep your database data.

### Change the code

The API code is copied into the image. When you change the code, you must build the image again:

```bash
docker compose up -d --build
```

The package layer is cached. Docker installs the packages again only when `package.json` changes.

## Reset the database

> **CAUTION**
> This command deletes all database data and all uploaded files. You cannot undo it.

```bash
docker compose down -v
docker compose up -d
```

The API creates the tables and inserts the default accounts again.

## Connect to the database

Use a MySQL client, such as MySQL Workbench, with these values:

| Setting | Value |
|---|---|
| Host | `127.0.0.1` |
| Port | `3308` |
| User | `root` |
| Password | `1234` |
| Database | `dmoneydb` |

You can also open a MySQL shell in the container:

```bash
docker exec -it dmoney-mysql mysql -uroot -p1234 dmoneydb
```

## Settings

The default settings come from `.env.example`. You do not need to create any file to run the API.

To change a setting, such as the Stripe key or the email account:

1. Copy `.env.example` to `.env`.
2. Edit the values in `.env`.
3. Run `docker compose up -d --build`.

> **NOTE**
> Docker sets `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD` for the API. Values for these names in `.env` do not change the API connection.

> **CAUTION**
> MySQL reads `DB_PASSWORD` only when it creates a new volume. If you change `DB_PASSWORD` later, the API cannot log in to the old database. To use the new password, run the commands in "Reset the database".

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| `Cannot connect to the Docker daemon` or a pipe error | Docker Desktop is not running. | Start Docker Desktop. Run the command again. |
| `port is already allocated` | Another program uses port `5000` or `3308`. | Stop that program. Or change the left number in `ports` in `docker-compose.yml`, for example `"5001:5000"`. |
| `dmoney-api` stays in the `Created` state | The API waits for MySQL to be `healthy`. | Wait 30 seconds. Run `docker compose ps`. If MySQL is not healthy, run `docker compose logs mysql`. |
| The API container stops after it starts | The API cannot connect to MySQL. | Run `docker compose logs dmoney-api`. If you changed `DB_PASSWORD`, reset the database. |
| `User not found` (HTTP 404) at login | The Docker database has only the default accounts. Data in a different MySQL server is not in Docker. | Log in with a default account from the table above. Or register a new user. |
| The build seems stuck | Docker is downloading images or packages. | Run `docker compose --progress=plain up -d --build` to see each step. |
