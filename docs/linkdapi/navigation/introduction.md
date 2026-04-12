# LinkdAPI Documentation - The best API for professional Data

# LinkdAPI Documentation

The best API for professional data enrichment and business intelligence.

50+

API Endpoints

<2s

Avg Response Time

100

Free Credits

[

### Endpoint Reference

Browse all available API endpoints with parameters and examples

](/docs)[

### Endpoint Pricing

Stay in control with clear endpoint credit costs and deliberate planning.

](/docs/endpoints-cost)

## Overview

LinkdAPI provides a robust set of endpoints to access professional profile data, company insights, and employment trends programmatically. Retrieve structured, reliable, and real-time information for analytics, CRM enrichment, and workflow automation.

OpenAPI Specification

Download our full API spec (OpenAPI 3.0)

[Download YAML](/apispec.yml)

## API Base URL

`https://linkdapi.com/`

## Authentication

**Recommended:** Use our official Python or Go SDK for the easiest integration experience with built-in error handling and async support.

### Official SDKs

Our official SDKs simplify integration with LinkdAPI, handling authentication, rate limiting, retries, and error handling automatically. Available for Python and Go.

#### Python SDK

1.  **Install the library:**

    `pip install linkdapi`

2.  **GitHub Repository:** [linkdAPI/linkdapi-SDK](https://github.com/linkdAPI/linkdapi-SDK)
3.  **PyPI Package:** [linkdapi on PyPI](https://pypi.org/project/linkdapi/)
4.  **Basic usage:**

    from linkdapi import LinkdAPI

    # Initialize with your API key

    api = LinkdAPI("your_api_key_here")

    # Get complete profile data in one call

    profile = api.get_full_profile(
    username="ryanroslansky",
    )

    print(profile)

#### Go SDK

1.  **Install the package:**

    `go get github.com/linkdAPI/linkdapi-go-sdk`

2.  **GitHub Repository:** [linkdAPI/linkdapi-go-sdk](https://github.com/linkdAPI/linkdapi-go-sdk)
3.  **Basic usage:**

    package main

    import (
    "fmt"
    "github.com/linkdAPI/linkdapi-go-sdk"
    )

    func main() {
    // Initialize client
    client := linkdapi.NewClient("your_api_key_here")

        // Get complete profile data
        profile, err := client.GetFullProfile(
            "ryanroslansky",
        )

        if err != nil {
            panic(err)
        }

        fmt.Println(profile)

    }

### Direct API Integration

The preferred way to use LinkdAPI is by signing up directly on our platform. This gives you more flexibility, faster access, and direct support without going through any third-party provider.

1.  **Create an account:** [https://linkdapi.com/signup](https://linkdapi.com/signup) (Get 100 free credits, no credit card required)
2.  After signing up, you'll receive your unique API key from your dashboard.
3.  Include the following header in all your API requests:

    `X-linkdapi-apikey: your_api_key_here`

4.  You're ready to start making real-time requests to our endpoints!

### Using LinkdAPI via RapidAPI (optional)

If you prefer or already use RapidAPI, you can still access LinkdAPI through their platform. However, we recommend using our direct integration above for better performance, lower costs, and direct support.

To use RapidAPI: [sign up here](https://rapidapi.com/linkdapi-linkdapi-default/api/linkdapi-best-unofficial-linkedin-api/pricing).

Then include your RapidAPI key in the header as shown below:

`X-RapidAPI-Key: your_RapidAPI_key_here`

## Available Endpoints

The API is organized into several categories covering profiles, companies, jobs, posts, and search. Use the left sidebar to explore all available endpoints and their parameters.

## Response Format

All API responses are returned in JSON format with consistent structure:

{
"success": true,
"statusCode": 200,
"message": "Data retrieved successfully",
"data": {
// Your requested data
}
}

## Getting Started

To start using LinkdAPI in 5 minutes:

1.  Create an account at [linkdapi.com/signup](https://linkdapi.com/signup) (100 free credits)
2.  Copy your API key from the dashboard
3.  Install our SDK: `pip install linkdapi` (Python) or `go get github.com/linkdAPI/linkdapi-go-sdk` (Go)
4.  Initialize the client with your API key
5.  Start making requests using the simplified interface

## Example Requests

Here's how to make a sample request using different methods. We're using the `get_full_profile` endpoint which returns complete profile data in a single call:

### Using our Official Python SDK (Recommended)

\# Install: pip install linkdapi
from linkdapi import LinkdAPI

# Initialize client

api = LinkdAPI("your_api_key_here")

# Get complete profile (overview + details + experience in one call)

profile = api.get_full_profile(
username="ryanroslansky",
)

print(profile)

### Using our Official Go SDK

// Install: go get github.com/linkdAPI/linkdapi-go-sdk
package main

import (
"fmt"
"github.com/linkdAPI/linkdapi-go-sdk"
)

func main() {
client := linkdapi.NewClient("your_api_key_here")

    profile, err := client.GetFullProfile(
        "ryanroslansky",
    )

    if err != nil {
        panic(err)
    }

    fmt.Println(profile)

}

### Using `curl`

curl -X GET "https://linkdapi.com/api/v1/profile/full?username=ryanroslansky" \\
-H "X-linkdapi-apikey: your_api_key_here"

### Using `fetch` (JavaScript)

fetch("https://linkdapi.com/api/v1/profile/full?username=ryanroslansky", {
headers: {
"X-linkdapi-apikey": "your_api_key_here"
}
}).then(res => res.json())
.then(data => console.log(data))

### Using `Python (requests)`

import requests

url = "https://linkdapi.com/api/v1/profile/full"
params = {
"username": "ryanroslansky",
}
headers = {
"X-linkdapi-apikey": "your_api_key_here"
}

response = requests.get(url, params=params, headers=headers)
print(response.json())

### Using `Go (net/http)`

package main

import (
"fmt"
"io/ioutil"
"net/http"
)

func main() {
client := &http.Client{}
url := "https://linkdapi.com/api/v1/profile/full?username=ryanroslansky"

    req, \_ := http.NewRequest("GET", url, nil)
    req.Header.Add("X-linkdapi-apikey", "your\_api\_key\_here")

    res, \_ := client.Do(req)
    defer res.Body.Close()
    body, \_ := ioutil.ReadAll(res.Body)

    fmt.Println(string(body))

}

### Using `PHP (cURL)`

<?php

$curl = curl\_init();

curl\_setopt\_array($curl, \[
    CURLOPT\_URL => "https://linkdapi.com/api/v1/profile/full?username=ryanroslansky",
    CURLOPT\_RETURNTRANSFER => true,
    CURLOPT\_HTTPHEADER => \[
        "X-linkdapi-apikey: your\_api\_key\_here"
    \],
\]);

$response = curl\_exec($curl);
curl\_close($curl);

echo $response;

## Error Handling & Troubleshooting

LinkdAPI returns consistent and informative error messages. Always check for `success: false` and review the `statusCode` and `message` fields for details.

### Too Many Requests (Example: Developer tier - message varies by tier)

{
  "success": false,
  "statusCode": 429,
  "message": "Too many requests for your tier \\"Developer\\". You've reached the highest tier.",
  "errors": {
    "current\_limit": "25 requests/minute",
    "current\_tier": "Developer"
  },
  "data": null
}

### Missing API Key

{
  "success": false,
  "statusCode": 401,
  "message": "Missing API Key in X-linkdapi-apikey header",
  "errors": null,
  "data": null
}

### Route Not Found

{
  "success": false,
  "statusCode": 404,
  "message": "Route not found",
  "errors": null,
  "data": null
}

If you receive an unexpected error, double-check your endpoint URL, HTTP method, parameters, and API key. Still stuck? Reach out to [support@linkdapi.com](mailto:support@linkdapi.com) or check our [help center](https://linkdapi.com/help-center).

## Rate Limits

API rate limits vary by subscription plan. All plans include generous limits designed for real-world usage. Need higher limits or custom enterprise access? Contact us at [support@linkdapi.com](mailto:support@linkdapi.com).

### Ready to build?

Start with 100 free credits and experience the difference fresh data makes. Questions? Reach out to [support@linkdapi.com](mailto:support@linkdapi.com)

[Create Free Account](/signup)[Explore Endpoints](/docs)
