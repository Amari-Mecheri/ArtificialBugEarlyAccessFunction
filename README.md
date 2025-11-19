# ArtificialBugEarlyAccessFunction

ArtificialBug Early Access Function is a serverless Azure Function project designed to manage https://artificialBug.com's waitlist with Azure Cosmos DB (Azure table and SQL Database options are provided for reference).

## Features

- **Waitlist Management**: Handles user sign-ups for a waitlist, ensuring no duplicate entries.
- **Ping Request Handling**: Responds to ping requests for health checks.
- **Azure Cosmos DB Integration**: Stores and retrieves waitlist data efficiently.
- **CORS Support**: Configured to handle cross-origin requests for enhanced flexibility.

## Project Structure

```
host.json
local.settings.json
package.json
README.md
HttpTrigger1/
    azureSQLDatabase.js
    azureTable.js
    function.json
    index.js
Waitlist/
```

### Key Files

- **`HttpTrigger1/index.js`**: Contains the main logic for handling HTTP requests, including:
  - Validating email addresses.
  - Checking for duplicate entries in the waitlist.
  - Adding new entries to the waitlist in Azure Cosmos DB.
  - Responding to ping requests.
- **`HttpTrigger1/azureSQLDatabase.js`**: Demonstrates how to connect to Azure SQL Database with retry mechanisms and optimized connection pooling.
- **`HttpTrigger1/azureTable.js`**: Provides an example of interacting with Azure Table Storage, including email validation and CORS headers.

## Getting Started

### Prerequisites

- Node.js
- Azure Functions Core Tools
- Azure Subscription

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Amari-Mecheri/ArtificialBugEarlyAccessFunction.git
   cd ArtificialBugEarlyAccessFunction
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `local.settings.json`:
   - For Azure Cosmos DB:
     - `COSMOS_ENDPOINT`
     - `COSMOS_KEY`
   - For Azure SQL Database:
     - `SQL_USER`
     - `SQL_PASSWORD`
     - `SQL_SERVER`
     - `SQL_DATABASE`
   - For Azure Table Storage:
     - `AZURE_STORAGE_ACCOUNT`
     - `AZURE_STORAGE_KEY`
   - For Ping Requests:
     - `PING_REQUEST_HEADER`

### Running the Project

Start the Azure Functions host:
```bash
npm run start
```

### Deployment

Deploy the function to Azure using the Azure CLI:
```bash
func azure functionapp publish <FunctionAppName>
```

## References

### Main Logic

The `index.js` file contains the core logic for the application, including:
- Validating and processing user requests.
- Interacting with Azure Cosmos DB to manage waitlist entries.
- Handling ping requests for health checks.

### Azure SQL Database Connection

The `azureSQLDatabase.js` file demonstrates how to connect to an Azure SQL Database with retry logic and optimized connection pooling.

### Azure Table Storage Connection

The `azureTable.js` file provides an example of interacting with Azure Table Storage. Key features include:
- Email validation.
- CORS headers for cross-origin requests.

## License

This project is licensed under the MIT License.
