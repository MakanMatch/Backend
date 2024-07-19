# Configuring System Operation

## Configuration Template

You can use the following configuration template (or alternatively copy from `boilerplateConfig.json`) to add/update configurations in your `config.json`.

```json
{
    "development": {
        "username": "root", // required (MySQL mode)
        "password": null, // required (MySQL mode)
        "database": "database_development", // required (MySQL mode)
        "host": "127.0.0.1", // required (MySQL mode)
        "dialect": "mysql", // required ('mysql', 'sqlite')
        "logging": true, // optional, default: console.log
        "loggingOptions": { // optional
            "logsFile": "sqlQueries.txt", // optional, default: 'sqlQueries.txt'. SQL query executions will be logged in this file if 'useFileLogging' is to true.
            "useFileLogging": false, // optional, default: false. Set to true to log SQL queries to file.
            "logPostBootOnly": false, // optional, default: false. Set to true to log SQL queries only after the system has booted.
            "clearUponBoot": false // optional, default: false. Set to true to clear the SQL query logs file upon boot.
        },
        "routeLogging": false, // optional, default: false. Set to true to log all incoming requests in the console.
        "routerRegistration": "manual" // optional, default: 'manual'. Set to 'automated' to automatically detect and register routes. Requires automated route export syntax.
    }
}
```

## Environment Variables Template

Use this template to satisfy the required environment variables demanded by `BootCheck` and the codebase:

```env
SERVER_PORT= # Usually 8000
DEBUG_MODE=
DB_MODE=
DB_CONFIG=
EMAILING_ENABLED=
EMAIL_ADDRESS=
EMAIL_PASSWORD=
STORAGE_BUCKET_URL=
FIRESTORAGE_ENABLED=
FILEMANAGER_ENABLED=
LOGGING_ENABLED=
API_KEY=
JWT_KEY=
WS_PORT= # Usually 8080
```

## Database Configuration

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

### MySQL Mode

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

### Sqlite Mode

No configuration is needed for Sqlite mode. The system will automatically create a `database.sqlite` file in the root directory and use it.

## All Data Stores

There's quite a few places you can store data in this codebase. Here's a list of all the data stores and their purposes:

- **`SQL Database`**
    - Managed by [Sequelize ORM](https://sequelize.org)
    - Stores all application data
    - Defined by models in `./models`
    - Database initialisation and sequelize setup is done by `./models/index.js` automatically. Exports hard-imported and detected models along with `sequelize` instance.
- `./FileStore`
    - Used to store files uploaded by users
    - Managed by `FileManager` service at `./services/FileManager.js`
    - Is programmatically enforced to have a `context.json`, a representation of all files currently in the store
- `./cache.json`
    - Used to store byte-sized data for small persistence needs
    - A local JSON file, so data integrity is not maintained in the situation of snapshot-based boots in the cloud
    - Managed by `Cache` service at `./services/Cache.js`
- `./logs.txt`
    - Used by `Logger` service at `./services/Logger.js` to log all system logs from across the entire codebase
    - Logs are timestamped and stored.
    - Logs are expected to have "log tags" (`ORDERS`, `LISTINGS`, `ERROR` etc.) followed by the log message. E.g: `ORDERS CONFIRMRESERVATION ERROR: Failed to create reservation; error: Sequelize connection failed.`
- `Universal.data`
    - In-memory storage located in `Universal` service at `./services/Universal.js`
    - Should be used for debugging purposes only

## Authentication System

### Backend View

The system uses JWT for authentication. The JWT secret is stored in the `.env` file as `JWT_KEY`.

JWTs should be signed, refreshed and verified with the `TokenManager` service at `./services/TokenManager.js`.

The system uses a middleware to authenticate requests. The middleware, `validateToken` is located at `./middleware/auth.js`. This middleware uses `TokenManager` to verify the JWT.

Payload schema of a MakanMatch JWT:
```json
{
    "userID": string,
    "username": string
    "userType": string
}
```

Standard flow:
1. User logs in with their credentials
2. Login endpoints use `TokenManager` to sign a JWT and return it to the user
3. User sends JWT in the `Authorization` header of their requests as `Bearer <JWT>`

Token expiring soon:
1. User sends JWT that expires in 10 minutes or less in the `Authorization` header of their requests
2. `validateToken` middleware detects expiring JWT and signs a new JWT. This is inserted into the response headers as `refreshedtoken`.
3. Client replaces the expiring token with the new token detected in the response headers.

Token expired:
1. User sends expired JWT in the `Authorization` header of their requests
2. `validateToken` middleware detects expired JWT and sends a `403 Forbidden` response and indicates that their token has expired
3. Client must send new request to login endpoint to get a new JWT

### Frontend view

Frontend requests to the backend are centralised through an axios instance configured with the backend server's base URL at `./src/networking.js`.

This instance has been configured with request and response interceptors to help manage authentication and authorisation.

JWTs are stored in `localStorage` at `jwt`. These will automatically be added to the `Authorization` header of all requests by the request interceptor.

The response interceptor will detect if the JWT is expiring soon or has expired. As such, one of the following scenarios occur:
- `refreshedtoken` header detected in response
    - This indicates that the JWT needs to be replaced as it's expiring.
    - The new JWT is stored in `localStorage` and replaces the old JWT.
- `403 Forbidden` response detected (token expired situation only)
    - If the token has expired, the `jwt` item is removed from `localStorage`.

The response interceptor successfully keeps `localStorage` up-to-date. However, the frontend uses `AuthState` (at `./src/slices/AuthState.js`), which is a redux slice, to keep track of the user's authentication state. This slice needs to be updated, so that user-dependent UI components and logic appropriately re-render/run to reflect the changes.

Thus, `AuthState.js` exports a method called `reloadAuthToken(authToken)` that should be called immediately after every request. This method updates the redux state with the new JWT, triggering a re-render of the UI.

The method takes in an auth token, from the `AuthState` redux itself, and returns a function which itself takes in a `useDispatch` hook initialisation. This dispatch hook is used to dispatch updates to the redux state, triggering the actual re-render. See `./src/slices/AuthState.js` for more information.

Thus, whenever you are writing code that makes a request to the backend using the `server` instance from `./src/networking.js`, you need to call `dispatch(reloadAuthToken(authToken))` immediately after the request, in both the `.then` and `.catch` blocks. Sample implementation:

```js
// Sample implementation of a component that needs a user to be logged in to access it

import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { reloadAuthToken } from './slices/AuthState';

function MyReactComponent() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { loaded, user, authToken } = useSelector(state => state.auth);

    useEffect(() => {
        if (loaded == true) {
            if (!user) {
                console.log("User is not logged in! Re-directing to homepage.")
                alert("Please sign in first.")
                navigate("/")
                return
            }

            // Example request to backend server
            server.get("/somedata")
                .then(res => {
                    dispatch(reloadAuthToken(authToken))

                    // Carry on with your own response processing
                })
                .catch(err => {
                    dispatch(reloadAuthToken(authToken))

                    // Carry on with your own error handling
                })
        }
    }, [loaded, user])

    if (loading) {
        return <h1>Loading...</h1>
    }

    return (
        <div>
            {/* Your component JSX */}
            <h1>Hello, {user.username}!</h1>
        </div>
    )
}
```

In the above component, as you may have observed, if the user's token expires, the `reloadAuthToken` method will update the redux state, causing `user` to be `null`, triggering a re-render, re-running the `user`-dependent `useEffect`, redirecting the user to the homepage.
