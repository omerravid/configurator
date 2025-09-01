using ConfigurationManager.Client;
using ConfigurationManager.Client.Exceptions;
using System;
using System.Threading.Tasks;

class Program
{
    static async Task Main(string[] args)
    {
        // Your server URL - replace with your actual server address
        string baseUrl = "http://172.23.0.1:3002/api";
        
        // Demo credentials (replace with your actual credentials)
        string username = "admin";
        string password = "admin123";
        
        try
        {
            // Step 1: Create client for login-based authentication
            using var client = ConfigurationManagerClientFactory.CreateForLogin(baseUrl);
            
            // Step 2: Login with username and password
            Console.WriteLine("Logging in...");
            var authResponse = await client.Auth.LoginAsync(username, password);

            // IMPORTANT: Set the JWT token for all services after login
            client.SetJwtToken(authResponse.Token);

            Console.WriteLine($"✓ Logged in successfully as: {authResponse.User.Username}");
            Console.WriteLine($"✓ Role: {authResponse.User.Role}");
            
            // Step 3: Get configuration value by name
            string configurationName = "Tools";
            string path = "ScrewInserter.220002.ScrewInserterParams.ToolType";
            bool minimal = true;
            
            Console.WriteLine($"\nGetting value from configuration '{configurationName}' at path '{path}'...");
            
            var valueResponse = await client.Configurations.GetConfigurationValueByNameAsync(
                configurationName: configurationName,
                path: path,
                minimal: minimal);
            
            Console.WriteLine($"✓ Value retrieved: {valueResponse.Value}");
            
            // Step 4: Additional examples - Get entire configuration
            Console.WriteLine($"\nGetting entire configuration '{configurationName}'...");
            var fullConfigResponse = await client.Configurations.GetConfigurationValueByNameAsync(
                configurationName: configurationName,
                minimal: false);
            
            Console.WriteLine($"✓ Full configuration data retrieved (length: {fullConfigResponse.Value?.ToString()?.Length ?? 0} characters)");
            
            // Step 5: List all configurations (optional)
            Console.WriteLine("\nListing all configurations...");
            var configsResponse = await client.Configurations.GetConfigurationsAsync();
            Console.WriteLine($"✓ Found {configsResponse.Configs.Count} configurations:");
            
            foreach (var config in configsResponse.Configs.Take(5)) // Show first 5
            {
                Console.WriteLine($"  - {config.Name} ({config.Type}) - {config.Status}");
            }
            
            if (configsResponse.Configs.Count > 5)
            {
                Console.WriteLine($"  ... and {configsResponse.Configs.Count - 5} more");
            }
        }
        catch (AuthenticationException ex)
        {
            Console.WriteLine($"❌ Authentication failed: {ex.Message}");
            Console.WriteLine("Please check your username and password.");
        }
        catch (NotFoundException ex)
        {
            Console.WriteLine($"❌ Configuration not found: {ex.Message}");
            Console.WriteLine("Please check the configuration name and path.");
        }
        catch (AuthorizationException ex)
        {
            Console.WriteLine($"❌ Access denied: {ex.Message}");
            Console.WriteLine("You don't have permission to access this resource.");
        }
        catch (ApiException ex)
        {
            Console.WriteLine($"❌ API error: {ex.Message}");
            Console.WriteLine($"Status code: {ex.StatusCode}");
            if (ex.ErrorResponse != null)
            {
                Console.WriteLine($"Details: {ex.ErrorResponse.Details}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Unexpected error: {ex.Message}");
        }
        
        Console.WriteLine("\nPress any key to exit...");
        Console.ReadKey();
    }
}

// Alternative example using async/await with proper error handling
public class ConfigurationValueRetriever
{
    private readonly IConfigurationManagerClient _client;
    
    public ConfigurationValueRetriever(string baseUrl, string username, string password)
    {
        _client = ConfigurationManagerClientFactory.CreateForLogin(baseUrl);
    }
    
    public async Task<string?> LoginAndGetValueAsync(string username, string password,
        string configurationName, string path, bool minimal = true)
    {
        try
        {
            // Login
            var authResponse = await _client.Auth.LoginAsync(username, password);

            // IMPORTANT: Set the JWT token for all services after login
            _client.SetJwtToken(authResponse.Token);

            // Get value
            var valueResponse = await _client.Configurations.GetConfigurationValueByNameAsync(
                configurationName, path, minimal);

            return valueResponse.Value?.ToString();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
            throw;
        }
    }
    
    public void Dispose()
    {
        _client?.Dispose();
    }
}
