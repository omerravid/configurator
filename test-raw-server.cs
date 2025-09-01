using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Text.Json;

class RawServerTest
{
    static async Task Main(string[] args)
    {
        string baseUrl = "http://172.23.0.1:3002/api";
        
        using var httpClient = new HttpClient();
        
        try
        {
            // Step 1: Login to get JWT token
            Console.WriteLine("=== LOGIN ===");
            var loginData = new { username = "admin", password = "admin123" };
            var loginJson = JsonSerializer.Serialize(loginData);
            var loginContent = new StringContent(loginJson, Encoding.UTF8, "application/json");
            
            var loginResponse = await httpClient.PostAsync($"{baseUrl}/auth/login", loginContent);
            var loginResponseText = await loginResponse.Content.ReadAsStringAsync();
            Console.WriteLine($"Login response: {loginResponseText}");
            
            if (!loginResponse.IsSuccessStatusCode)
            {
                Console.WriteLine("❌ Login failed");
                return;
            }
            
            var loginResult = JsonSerializer.Deserialize<JsonElement>(loginResponseText);
            var token = loginResult.GetProperty("token").GetString();
            Console.WriteLine($"✓ Got token: {token?.Substring(0, 20)}...");
            
            // Step 2: Set authorization header
            httpClient.DefaultRequestHeaders.Authorization = 
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            
            // Step 3: Test the problematic endpoint
            string configName = "Tools";
            string path = "ScrewInserter.220002.ScrewInserterParams";
            
            var testUrl = $"{baseUrl}/configs/by-name/{configName}/data?path={Uri.EscapeDataString(path)}&minimal=true";
            Console.WriteLine($"\n=== TESTING URL ===");
            Console.WriteLine($"URL: {testUrl}");
            
            var response = await httpClient.GetAsync(testUrl);
            var responseText = await response.Content.ReadAsStringAsync();
            
            Console.WriteLine($"Status: {response.StatusCode}");
            Console.WriteLine($"Response Headers:");
            foreach (var header in response.Headers)
            {
                Console.WriteLine($"  {header.Key}: {string.Join(", ", header.Value)}");
            }
            Console.WriteLine($"Content Headers:");
            foreach (var header in response.Content.Headers)
            {
                Console.WriteLine($"  {header.Key}: {string.Join(", ", header.Value)}");
            }
            Console.WriteLine($"Response Text: '{responseText}'");
            Console.WriteLine($"Response Length: {responseText?.Length ?? 0}");
            Console.WriteLine($"Response Bytes: [{string.Join(", ", Encoding.UTF8.GetBytes(responseText ?? ""))}]");
            
            if (response.IsSuccessStatusCode)
            {
                if (string.IsNullOrWhiteSpace(responseText))
                {
                    Console.WriteLine("⚠️ SUCCESS but response is empty!");
                }
                else
                {
                    try
                    {
                        var parsed = JsonSerializer.Deserialize<JsonElement>(responseText);
                        Console.WriteLine($"✓ Valid JSON - ValueKind: {parsed.ValueKind}");
                        Console.WriteLine($"✓ Raw JSON: {parsed.GetRawText()}");
                    }
                    catch (JsonException ex)
                    {
                        Console.WriteLine($"❌ Invalid JSON: {ex.Message}");
                    }
                }
            }
            else
            {
                Console.WriteLine($"❌ Request failed: {response.StatusCode}");
            }
            
            // Test without path to see full config
            Console.WriteLine($"\n=== TESTING FULL CONFIG ===");
            var fullUrl = $"{baseUrl}/configs/by-name/{configName}/data?minimal=true";
            Console.WriteLine($"URL: {fullUrl}");
            
            var fullResponse = await httpClient.GetAsync(fullUrl);
            var fullResponseText = await fullResponse.Content.ReadAsStringAsync();
            
            Console.WriteLine($"Status: {fullResponse.StatusCode}");
            Console.WriteLine($"Response Length: {fullResponseText?.Length ?? 0}");
            
            if (fullResponse.IsSuccessStatusCode && !string.IsNullOrWhiteSpace(fullResponseText))
            {
                try
                {
                    var fullParsed = JsonSerializer.Deserialize<JsonElement>(fullResponseText);
                    Console.WriteLine($"✓ Full config - ValueKind: {fullParsed.ValueKind}");
                    
                    if (fullParsed.ValueKind == JsonValueKind.Object)
                    {
                        Console.WriteLine("Available top-level properties:");
                        foreach (var prop in fullParsed.EnumerateObject())
                        {
                            Console.WriteLine($"  - {prop.Name}: {prop.Value.ValueKind}");
                        }
                    }
                }
                catch (JsonException ex)
                {
                    Console.WriteLine($"❌ Invalid JSON in full config: {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error: {ex.Message}");
            Console.WriteLine($"Stack: {ex.StackTrace}");
        }
        
        Console.WriteLine("\nPress any key to exit...");
        Console.ReadKey();
    }
}
