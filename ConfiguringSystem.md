# Configuring System Operation

There's a few ways you can configure the database the backend system uses.

`DB_MODE` is a mandatory `.env` variable that needs to be set.

Database Modes:
- MySQL (`mysql`)
    - Set `DB_MODE` to `mysql` in `.env` file
    - Store your configuration details in `config/config.json`. You can rename and use `boilerplateConfig.json`.
    - You can create multiple configurations and switch between them by changing `DB_CONFIG` in `.env` file.
- Sqlite (`sqlite`)
    - Set `DB_MODE` to `sqlite` in `.env` file
    - `database.sqlite` file will be auto-created in root directory and used

## MySQL Mode

For each configuration, you need to provide:
- `username`
- `password`
- `database`
- `host`
- `dialect` (mysql)

Example configurations in `config/config.json`:
```json
{
    "rds": {
        "username": "AWSRelationalDatabaseServiceUser",
        "password": "password",
        "database": "mydatabase",
        "host": "mydatabase.x.us-east-1.rds.amazonaws.com",
        "dialect": "mysql"
    },
    "local": {
        "username": "root",
        "password": "password",
        "database": "mydatabase",
        "host": "localhost",
        "dialect": "mysql"
    }
}
```

Select your configuration by changing `DB_CONFIG` in `.env` file. For example, if I wanted the system to use my local MySQL server, I would set `DB_CONFIG=local`. Otherwise, if I wanted to use an AWS RDS instance, I would set `DB_CONFIG=rds`.

The value is the same as the key of your configuration in `config/config.json`.

## Sqlite Mode

No configuration is needed for Sqlite mode. The system will automatically create a `database.sqlite` file in the root directory and use it.