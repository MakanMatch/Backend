import os, sys, json, datetime, requests, time
from pprint import pprint
from getpass import getpass

print("Welcome to the MakanMatch System Superuser Console.")
print("With this script, easily manage admin accounts and operational settings of a MakanMatch Backend system.")
print()

# Define the base URL of the Key Server
baseURL = input("Enter MakanMatch system location (e.g. http://localhost:5000): ")
if baseURL == "":
    baseURL = "https://makanmatchbackend.replit.app"

serverPath = lambda path: baseURL + path

headers = {
    "Content-Type": "application/json"
}
serverKey = None

# Check connection to the MakanMatch System
print()
print("Checking connection to server...")
try:
    healthCheck = requests.get(serverPath("/admin/super"))

    healthCheck.raise_for_status()
    if not healthCheck.text.startswith("SUCCESS"):
        print("ERROR: MakanMatch Superuser API is not healthy.")
        sys.exit(1)

    print("Connection successful!")
except Exception as e:
    print("ERROR: Could not connect to MakanMatch system. Error: " + str(e))
    sys.exit(1)

# Authenticate using server admin credentials
print()
serverKey = input("Enter superuser access key: ")
while True:
    print()
    print("Authorising...")
    headers["AccessKey"] = serverKey
    authResponse = None
    try:
        authResponse = requests.post(
            url=serverPath("/admin/super/authenticate"),
            headers=headers
        )

        authResponse.raise_for_status()
        if authResponse.text.startswith("ERROR"):
            raise Exception(authResponse.text[len("ERROR: "):])
        if not authResponse.text.startswith("SUCCESS"):
            raise Exception("Unknown response received: " + authResponse.text)
        
        print("Authorised successfully!")
        break
    except Exception as e:
        del headers["AccessKey"]
        print("Error occurred in authenticating with server. Error: " + str(e))
        try:
            print("Server response: " + authResponse.text)
        except:
            print("Server response: <No response>")
        retry = input("Retry? (y/n): ").lower()
        if retry != "y":
            sys.exit(1)
        print()
        serverKey = input("Enter superuser access key: ")
        continue

# Start main functions
def retrieveAccountInfo():
    print()
    identifierType = input("Enter identifier type (ID/username/email): ").strip().lower()
    while identifierType not in ["id", "username", "email"]:
        identifierType = input("Invalid identifier type. Enter identifier type (ID/username/email): ").strip().lower()
    
    data = {}
    if identifierType == "id":
        data["userID"] = input("Enter user ID: ").strip()
        while data["userID"] == "":
            data["userID"] = input("User ID cannot be empty. Please enter a user ID: ").strip()
    elif identifierType == "username":
        data["username"] = input("Enter username: ").strip()
        while data["username"] == "":
            data["username"] = input("Username cannot be empty. Please enter a username: ").strip()
    else:
        data["email"] = input("Enter email: ").strip()
        while data["email"] == "":
            data["email"] = input("Email cannot be empty. Please enter an email: ").strip()
    
    print()
    print("Retrieving account information...")
    retrieveResponse = None
    while True:
        try:
            retrieveResponse = requests.post(
                url=serverPath("/admin/super/accountInfo"),
                headers=headers,
                json=data
            )

            retrieveResponse.raise_for_status()
            if retrieveResponse.text.startswith("ERROR"):
                raise Exception(retrieveResponse.text[len("ERROR: "):])
            elif retrieveResponse.text.startswith("UERROR"):
                raise Exception(retrieveResponse.text[len("UERROR: "):])
            
            print("Account information retrieved successfully!")
            print()
            
            responseJSON = json.loads(retrieveResponse.text)
            print("Retrieved information:")
            for key in responseJSON:
                print("\t{}: {}".format(key, responseJSON[key]))
            break
        except Exception as e:
            print("Error occurred in retrieving account information. Error: " + str(e))
            try:
                print("Server response: " + retrieveResponse.text)
            except:
                print("Server response: <No response>")
            retry = input("Retry? (y/n): ").lower()
            print()
            if retry != "y":
                print("Retrieve account information aborted.")
                break
            print("Retrieving account information...")


def createAdmin():
    print()
    username = input("Enter username for new MakanMatch admin: ").strip()
    while username == "":
        username = input("Username cannot be empty. Please enter a username: ").strip()
    
    fname = input("Enter first name: ").strip()
    while fname == "" or not fname.isalpha():
        fname = input("Invalid first name. Please re-enter: ").strip()
        
    lname = input("Enter last name: ").strip()
    while lname == "" or not lname.isalpha():
        lname = input("Invalid last name. Please re-enter: ").strip()
        
    email = input("Enter email: ").strip()
    while email == "" or "@" not in email:
        email = input("Invalid email. Please re-enter: ").strip()
    
    password = getpass("Enter password: ").strip()
    while password == "":
        password = getpass("Password cannot be empty. Please enter a password: ").strip()
    
    confirm = getpass("Confirm password: ").strip()
    while confirm != password:
        confirm = getpass("Passwords do not match. Please confirm password: ").strip()
    
    role = input("Enter admin's role: ").strip()
    while role == "":
        role = input("Role cannot be empty. Please enter a role: ").strip()

    print()
    print("Creating admin account...")
    createResponse = None
    while True:
        try:
            createResponse = requests.post(
                url=serverPath("/admin/super/createAdmin"),
                headers=headers,
                json={
                    "username": username,
                    "fname": fname,
                    "lname": lname,
                    "email": email,
                    "password": password,
                    "role": role
                }
            )

            createResponse.raise_for_status()
            if createResponse.text.startswith("ERROR"):
                raise Exception(createResponse.text[len("ERROR: "):])
            elif createResponse.text.startswith("UERROR"):
                raise Exception(createResponse.text[len("UERROR: "):])
            if not createResponse.text.startswith("SUCCESS"):
                raise Exception("Unknown response received: " + createResponse.text)
            
            print("Admin account created successfully! Username: '{}', Password: '{}'.".format(username, password))
            break
        except Exception as e:
            print("Error occurred in creating admin account. Error: " + str(e))
            try:
                print("Server response: " + createResponse.text)
            except:
                print("Server response: <No response>")
            retry = input("Retry? (y/n): ").lower()
            print()
            if retry != "y":
                print("Create account aborted.")
                break
            print("Creating admin account...")

def deleteAdmin():
    print()
    identifierType = input("Enter identifier type (ID/username/email): ").strip().lower()
    while identifierType not in ["id", "username", "email"]:
        identifierType = input("Invalid identifier type. Enter identifier type (ID/username/email): ").strip().lower()
    
    data = {}
    if identifierType == "id":
        data["userID"] = input("Enter admin ID: ").strip()
        while data["userID"] == "":
            data["id"] = input("Admin ID cannot be empty. Please enter an admin ID: ").strip()
    elif identifierType == "username":
        data["username"] = input("Enter admin username: ").strip()
        while data["username"] == "":
            data["username"] = input("Username cannot be empty. Please enter a username: ").strip()
    else:
        data["email"] = input("Enter admin email: ").strip()
        while data["email"] == "":
            data["email"] = input("Email cannot be empty. Please enter an email: ").strip()
    
    print()
    print("Deleting admin account...")
    deleteResponse = None
    while True:
        try:
            deleteResponse = requests.post(
                url=serverPath("/admin/super/deleteAdmin"),
                headers=headers,
                json=data
            )

            deleteResponse.raise_for_status()
            if deleteResponse.text.startswith("ERROR"):
                raise Exception(deleteResponse.text[len("ERROR: "):])
            elif deleteResponse.text.startswith("UERROR"):
                raise Exception(deleteResponse.text[len("UERROR: "):])
            if not deleteResponse.text.startswith("SUCCESS"):
                raise Exception("Unknown response received: " + deleteResponse.text)
            
            print("Admin account deleted successfully!")
            break
        except Exception as e:
            print("Error occurred in deleting admin account. Error: " + str(e))
            try:
                print("Server response: " + deleteResponse.text)
            except:
                print("Server response: <No response>")
            retry = input("Retry? (y/n): ").lower()
            print()
            if retry != "y":
                print("Delete account aborted.")
                break
            print("Deleting admin account...")
            
def retrieveAnalytics():
    print()
    print("Retrieving analytics...")
    analyticsResponse = None
    responseJSON = None
    while True:
        try:
            analyticsResponse = requests.post(
                url=serverPath("/admin/super/getAnalytics"),
                headers=headers
            )

            analyticsResponse.raise_for_status()
            if analyticsResponse.text.startswith("ERROR"):
                raise Exception(analyticsResponse.text[len("ERROR: "):])
            
            print("Analytics retrieved successfully!")
            print()
            
            responseJSON = json.loads(analyticsResponse.text)
            print("Retrieved analytics:")
            print()
            pprint(responseJSON)
            print()
            break
        except Exception as e:
            print("Error occurred in retrieving analytics. Error: " + str(e))
            try:
                print("Server response: " + analyticsResponse.text)
            except:
                print("Server response: <No response>")
            retry = input("Retry? (y/n): ").lower()
            print()
            if retry != "y":
                print("Retrieve analytics aborted.")
                break
            print("Retrieving analytics...")
    
    print()
    saveAnalyticsToFile = input("Save analytics data to file? (y/n) ").strip().lower()
    while saveAnalyticsToFile not in ["y", "n"]:
        saveAnalyticsToFile = input("Invalid choice. Save analytics data to file? (y/n) ").strip().lower()
    
    if saveAnalyticsToFile == "y":
        print()
        print("Saving analytics data to file...")
        with open("MakanMatchAnalytics.json", "w") as f:
            json.dump(responseJSON, f)
        print("Analytics data saved to MakanMatchAnalytics.json.")
        
def retrieveFileManagerContext():
    print()
    print("Retrieving file manager context...")
    contextResponse = None
    while True:
        try:
            contextResponse = requests.get(
                url=serverPath("/admin/super/getFileManagerContext"),
                headers=headers
            )

            contextResponse.raise_for_status()
            if contextResponse.text.startswith("ERROR"):
                raise Exception(contextResponse.text[len("ERROR: "):])
            
            print("File manager context retrieved successfully!")
            print()
            
            responseJSON = json.loads(contextResponse.text)
            print("Retrieved file manager context:")
            print()
            pprint(responseJSON)
            print()
            break
        except Exception as e:
            print("Error occurred in retrieving file manager context. Error: " + str(e))
            try:
                print("Server response: " + contextResponse.text)
            except:
                print("Server response: <No response>")
            retry = input("Retry? (y/n): ").lower()
            print()
            if retry != "y":
                print("Retrieve file manager context aborted.")
                return
            print("Retrieving file manager context...")
            
    saveToFile = input("Save file manager context to file? (y/n) ").strip().lower()
    if saveToFile == "y":
        print()
        print("Saving file manager context to file...")
        with open("MakanMatchFileManagerContext.json", "w") as f:
            json.dump(responseJSON, f)
        print("File manager context saved to MakanMatchFileManagerContext.json.")

def accessMakanMatchLogs():
    print()
    print("Accessing MakanMatch system logs...")
    logsResponse = None
    while True:
        try:
            logsResponse = requests.post(
                url=serverPath("/admin/super/getLogs"),
                headers=headers
            )

            logsResponse.raise_for_status()
            if logsResponse.text.startswith("ERROR"):
                raise Exception(logsResponse.text[len("ERROR: "):])
            
            print("Logs retrieved successfully!")
            print()
            break
        except Exception as e:
            print("Error occurred in accessing MakanMatch system logs. Error: " + str(e))
            try:
                print("Server response: " + logsResponse.text)
            except:
                print("Server response: <No response>")
            retry = input("Retry? (y/n): ").lower()
            print()
            if retry != "y":
                print("Access logs aborted.")
                return
            print("Accessing MakanMatch system logs...")
    
    try:
        logs = logsResponse.json()
        print("Logs:")
        for log in logs:
            print("\t" + log)
    except Exception as e:
        print("Failed to parse logs. Error: " + str(e))
        print("Raw logs:")
        print(logsResponse.text)
        return
        
    print()
    saveLogsToFile = input("Save logs to file? (y/n) ").lower()
    while saveLogsToFile not in ["y", "n"]:
        saveLogsToFile = input("Invalid choice. Save logs to file? (y/n) ").lower()
    
    if saveLogsToFile == "y":
        print()
        print("Saving logs to file...")
        with open("MakanMatchLogs.txt", "w") as f:
            f.write("\n".join(logs))
        print("Logs saved to MakanMatchLogs.txt.")
        
def toggleAnalytics():
    print()
    toggleStatus = input("Enable analytics? (y/n) ").strip().lower()
    while toggleStatus not in ["y", "n"]:
        toggleStatus = input("Invalid choice. Enable analytics? (y/n) ").strip().lower()
    toggleStatus = toggleStatus == "y"
    
    print()
    print("Toggling analytics...")
    toggleResponse = None
    while True:
        try:
            toggleResponse = requests.post(
                url=serverPath("/admin/super/toggleAnalytics"),
                headers=headers,
                json={
                    "newStatus": toggleStatus
                }
            )

            toggleResponse.raise_for_status()
            if toggleResponse.text.startswith("ERROR"):
                raise Exception(toggleResponse.text[len("ERROR: "):])
            elif toggleResponse.text.startswith("UERROR"):
                raise Exception(toggleResponse.text[len("UERROR: "):])
            if not toggleResponse.text.startswith("SUCCESS"):
                raise Exception("Unknown response received: " + toggleResponse.text)
            
            print("Analytics toggled successfully! Server: {}".format(toggleResponse.text))
            break
        except Exception as e:
            print("Error occurred in toggling analytics. Error: " + str(e))
            try:
                print("Server response: " + toggleResponse.text)
            except:
                print("Server response: <No response>")
            retry = input("Retry? (y/n): ").lower()
            print()
            if retry != "y":
                print("Toggle analytics aborted.")
                break
            print("Toggling analytics...")
            
def toggleOpenAIChat():
    print()
    toggleStatus = input("Enable MakanBot (OpenAI Chat)? (y/n) ").strip().lower()
    while toggleStatus not in ["y", "n"]:
        toggleStatus = input("Invalid choice. Enable MakanBot (OpenAI Chat)? (y/n) ").strip().lower()
    toggleStatus = toggleStatus == "y"
    
    print()
    print("Toggling MakanBot (OpenAI Chat)...")
    toggleResponse = None
    while True:
        try:
            toggleResponse = requests.post(
                url=serverPath("/admin/super/toggleMakanBot"),
                headers=headers,
                json={
                    "newStatus": toggleStatus
                }
            )

            toggleResponse.raise_for_status()
            if toggleResponse.text.startswith("ERROR"):
                raise Exception(toggleResponse.text[len("ERROR: "):])
            elif toggleResponse.text.startswith("UERROR"):
                raise Exception(toggleResponse.text[len("UERROR: "):])
            if not toggleResponse.text.startswith("SUCCESS"):
                raise Exception("Unknown response received: " + toggleResponse.text)
            
            print("MakanBot (OpenAI Chat) toggled successfully! Server: {}".format(toggleResponse.text))
            break
        except Exception as e:
            print("Error occurred in toggling MakanBot (OpenAI Chat). Error: " + str(e))
            try:
                print("Server response: " + toggleResponse.text)
            except:
                print("Server response: <No response>")
            retry = input("Retry? (y/n): ").lower()
            print()
            if retry != "y":
                print("Toggle MakanBot (OpenAI Chat) aborted.")
                break
            print("Toggling MakanBot (OpenAI Chat)...")
            
def toggleUsageLock():
    print()
    lockStatus = input("Lock system usage? (y/n) ").strip().lower()
    while lockStatus not in ["y", "n"]:
        lockStatus = input("Invalid choice. Lock system usage? (y/n) ").strip().lower()
    lockStatus = lockStatus == "y"
    
    print()
    print("Toggling usage lock...")
    toggleResponse = None
    while True:
        try:
            toggleResponse = requests.post(
                url=serverPath("/admin/super/toggleUsageLock"),
                headers=headers,
                json={
                    "newStatus": lockStatus
                }
            )

            toggleResponse.raise_for_status()
            if toggleResponse.text.startswith("ERROR"):
                raise Exception(toggleResponse.text[len("ERROR: "):])
            elif toggleResponse.text.startswith("UERROR"):
                raise Exception(toggleResponse.text[len("UERROR: "):])
            if not toggleResponse.text.startswith("SUCCESS"):
                raise Exception("Unknown response received: " + toggleResponse.text)
            
            print("Usage lock toggled successfully! Server: {}".format(toggleResponse.text))
            break
        except Exception as e:
            print("Error occurred in toggling usage lock. Error: " + str(e))
            try:
                print("Server response: " + toggleResponse.text)
            except:
                print("Server response: <No response>")
            retry = input("Retry? (y/n): ").lower()
            print()
            if retry != "y":
                print("Toggle usage lock aborted.")
                break
            print("Toggling usage lock...")

class Logger:
    @staticmethod
    def readAll():
        try:
            if os.path.exists(os.path.join(os.getcwd(), "MakanMatchLogs.txt")):
                with open("MakanMatchLogs.txt", "r") as f:
                    logs = f.readlines()
                    for logIndex in range(len(logs)):
                        logs[logIndex] = logs[logIndex].replace("\n", "")
                    return logs
            else:
                return []
        except Exception as e:
            print("LOGGER READALL ERROR: Failed to check and read MakanMatchLogs.txt file. Error: {}".format(e))
            return "ERROR: Failed to check and read MakanMatchLogs.txt file. Error: {}".format(e)
      
    @staticmethod
    def manageLogs():
        print("LOGGER: Welcome to the Logging Management Console.")
        while True:
            print("""
Commands:
    read <number of lines, e.g 50 (optional)>: Reads the last <number of lines> of logs. If no number is specified, all logs will be displayed.
    exit: Exit the Logging Management Console.
""")
    
            userChoice = input("Enter command: ")
            userChoice = userChoice.lower()
            while not userChoice.startswith("read") and (userChoice != "destroy") and (userChoice != "exit"):
                userChoice = input("Invalid command. Enter command: ")
                userChoice = userChoice.lower()
    
            if userChoice.startswith("read"):
                allLogs = Logger.readAll()
                targetLogs = []

                userChoice = userChoice.split(" ")

                # Log filtering feature
                if len(userChoice) == 1:
                    targetLogs = allLogs
                elif userChoice[1] == ".filter":
                    if len(userChoice) < 3:
                        print("Invalid log filter. Format: read .filter <keywords>")
                        continue
                    else:
                        try:
                            keywords = userChoice[2:]
                            for log in allLogs:
                                logTags = log[23::]
                                logTags = logTags[:logTags.find(":")].upper().split(" ")

                                ## Check if log contains all keywords
                                containsAllKeywords = True
                                for keyword in keywords:
                                    if keyword.upper() not in logTags:
                                        containsAllKeywords = False
                                        break
                                
                                if containsAllKeywords:
                                    targetLogs.append(log)
                                
                            print("Filtered logs with keywords: {}".format(keywords))
                            print()
                        except Exception as e:
                            print("LOGGER: Failed to parse and filter logs. Error: {}".format(e))
                            continue
                else:
                    logCount = 0
                    try:
                        logCount = int(userChoice[1])
                        if logCount > len(allLogs):
                            logCount = len(allLogs)
                        elif logCount <= 0:
                            raise Exception("Invalid log count. Must be a positive integer above 0 lower than or equal to the total number of logs.")
                        
                        targetLogs = allLogs[-logCount::]
                    except Exception as e:
                        print("LOGGER: Failed to read logs. Error: {}".format(e))
                        continue

                logCount = len(targetLogs)
                print()
                print("Displaying {} log entries:".format(logCount))
                print()
                for log in targetLogs:
                    print("\t{}".format(log))
            elif userChoice == "exit":
                print("LOGGER: Exiting Logging Management Console...")
                break
    
        return

while True:
    print("""
What would you like to do?
    1. Retrieve an account's information
    2. Create a new admin account
    3. Delete an existing admin account
    4. Retrieve collected analytics
    5. Retrieve system logs
    6. Retrieve FileManager context
    7. Toggle analytics
    8. Toggle MakanBot (OpenAIChat)
    9. Toggle usage lock
    10. Activate Logs Console
    0. Exit
""")
    
    choice = input("Enter your choice: ")
    while (not choice.isdigit()) or (int(choice) not in range(0, 11)):
        choice = input("Invalid choice. Please enter your choice: ")
    
    choice = int(choice)
    if choice == 1:
        retrieveAccountInfo()
        print()
    elif choice == 2:
        createAdmin()
        print()
    elif choice == 3:
        deleteAdmin()
        print()
    elif choice == 4:
        retrieveAnalytics()
        print()
    elif choice == 5:
        accessMakanMatchLogs()
        print()
    elif choice == 6:
        retrieveFileManagerContext()
        print()
    elif choice == 6:
        toggleAnalytics()
        print()
    elif choice == 7:
        toggleOpenAIChat()
        print()
    elif choice == 8:
        toggleUsageLock()
        print()
    elif choice == 9:
        Logger.manageLogs()
        print()
    else:
        print("Bye!")
        break