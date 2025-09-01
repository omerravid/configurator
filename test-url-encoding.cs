using ConfigurationManager.Client;
using ConfigurationManager.Client.Exceptions;
using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Web;

class UrlEncodingTest
{
    static async Task Main(string[] args)
    {
        string baseUrl = "http://172.23.0.1:3002/api";
        string username = "admin";
        string password = "admin123";
        
        try
        {
            using var client = ConfigurationManagerClientFactory.CreateForLogin(baseUrl);
            
            // Login
            Console.WriteLine("=== LOGIN ===");
            var authResponse = await client.Auth.LoginAsync(username, password);
            Console.WriteLine($"✓ Logged in as: {authResponse.User.Username}");
            
            // First, list all configurations to see what names exist
            Console.WriteLine("\n=== LISTING ALL CONFIGURATIONS ===");
            var allConfigs = await client.Configurations.GetConfigurationsAsync();
            Console.WriteLine($"Found {allConfigs.Configs.Count} configurations:");
            
            foreach (var config in allConfigs.Configs)
            {
                Console.WriteLine($"  - \"{config.Name}\" (Type: {config.Type}, Status: {config.Status})");
            }
            
            // Test URL encoding manually
            Console.WriteLine("\n=== URL ENCODING TEST ===");
            string testName = "FitnessWatch Pro - Sports Edition";
            string encoded = HttpUtility.UrlEncode(testName);
            Console.WriteLine($"Original: \"{testName}\"");
            Console.WriteLine($"Encoded: \"{encoded}\"");
            Console.WriteLine($"Decoded: \"{HttpUtility.UrlDecode(encoded)}\"");
            
            // Try to find configurations with similar names
            Console.WriteLine("\n=== SEARCHING FOR SIMILAR NAMES ===");
            var fitnessConfigs = allConfigs.Configs.Where(c => 
                c.Name.ToLower().Contains("fitness") || 
                c.Name.ToLower().Contains("watch") ||
                c.Name.ToLower().Contains("sports")
            ).ToList();
            
            Console.WriteLine($"Found {fitnessConfigs.Count} configs containing 'fitness', 'watch', or 'sports':");
            foreach (var config in fitnessConfigs)
            {
                Console.WriteLine($"  - \"{config.Name}\"");
            }
            
            // Try to access the specific configuration
            Console.WriteLine($"\n=== TESTING ACCESS TO: {testName} ===");
            try
            {
                var response = await client.Configurations.GetConfigurationValueByNameAsync(
                    testName, minimal: true);
                
                Console.WriteLine($"✓ Successfully found configuration: {testName}");
                var value = ExtractJsonElementValue(response.Value);
                Console.WriteLine($"  Data type: {value?.GetType().Name ?? "null"}");
            }
            catch (NotFoundException ex)
            {
                Console.WriteLine($"❌ Configuration not found: {ex.Message}");
                
                // Try with different variations
                var variations = new[]
                {
                    testName.Replace(" - ", " – "), // En dash vs hyphen  
                    testName.Replace(" - ", "-"),   // No spaces around dash
                    testName.Replace("-", "–"),     // Em dash
                    testName.Trim(),                // Trim whitespace
                };
                
                Console.WriteLine("\n=== TRYING VARIATIONS ===");
                foreach (var variation in variations)
                {
                    try
                    {
                        await client.Configurations.GetConfigurationValueByNameAsync(
                            variation, minimal: true);
                        Console.WriteLine($"✓ Found with variation: \"{variation}\"");
                        break;
                    }
                    catch (NotFoundException)
                    {
                        Console.WriteLine($"❌ Not found with variation: \"{variation}\"");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Other error: {ex.Message}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error: {ex.Message}");
        }
        
        Console.WriteLine("\nPress any key to exit...");
        Console.ReadKey();
    }

    static object? ExtractJsonElementValue(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt32(out var intVal) ? intVal : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            JsonValueKind.Array => element.EnumerateArray().Select(e => ExtractJsonElementValue(e)).ToArray(),
            JsonValueKind.Object => element.GetRawText(),
            JsonValueKind.Undefined => null,
            _ => element.GetRawText()
        };
    }
}
