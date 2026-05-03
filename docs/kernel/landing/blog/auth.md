# Introducing Managed Auth | Kernel Blog

february

ProductCatherine Juecopy link

# Introducing Managed Auth

Managed Auth gives AI agents a secure, standardized way to log in and stay logged in across the internet, supporting 2FA, SSO, and 1Password so they can safely browse the entire internet without ever exposing user credentials to LLMs.

The way we interact with the internet is changing. Early this week we [partnered with Vercel](https://www.kernel.sh/blog/webbotauth) to support the adoption of Web Bot Auth, giving agents a cryptographic way to prove their identity on the internet. But Web Bot Auth alone doesn’t let them safely access the parts of the internet we rely on most: the ones behind logins.

Today, we’re excited to introduce Managed Auth: a standardized way to let agents log in and stay logged in across the internet. 

## The browser is the auth primitive

The browser remains the primary gateway to the internet. So we set out to build Managed Auth around giving your agent a browser with scoped access to specific sites, always with the end user’s consent. 

Out of the box, Managed Auth supports 2FA, SSO, and 1Password and automatically refreshes login sessions so agents can keep working without additional user interaction. To simplify the initial setup, we provide a hosted UI to securely collect the credential from your users. Under the hood, a verified agent securely extracts those login details and signs you in to any website, powered by our partnership with Vercel.

![](https://cdn.sanity.io/images/7o5bsuld/production/d8505b697a2b0ae5f512b495d4a79ecb108a7aef-1440x1080.gif)

This prevents developers from having to reinvent the wheel with their own systems: collecting credentials from users for each site, storing them somewhere “safe,” designing consent flows, handling MFA, and injecting secrets into an agent loop without exposing them in plaintext.

## Only give agents an authenticated browser

Importantly, this approach never exposes your credentials to LLMs, while still giving them authenticated access to navigate dashboards, download reports, and browse the entire internet on your behalf. If something goes wrong, you can simply end the browser session and the agent immediately loses access.

## Where this is going

Managed Auth was developed in close collaboration with developers building browser agents that automate everything from [managing EHR workflows](https://www.kernel.sh/blog/felicity) and [answering calls](https://www.kernel.sh/blog/novoflow) to [purchasing on e-commerce sites](https://www.kernel.sh/blog/rye) and [manufacturing procurement](https://www.kernel.sh/blog/silkline). This is a big step toward solving authentication for agents on the internet. If you’re exploring the future of agent identity, we’d love to collaborate. Reach out to partnerships@kernel.sh. And if you want to learn more about how to get started with Managed Auth, checkout out our [docs](https://www.kernel.sh/docs/profiles/managed-auth/overview).

![Video thumbnail](https://img.youtube.com/vi/lK3YR8qzeH4/maxresdefault.jpg)

## more blog posts

[view all](/blog)

[

![Vercel & Kernel: Web Bot Auth for AI agents on the internet](https://cdn.sanity.io/images/7o5bsuld/production/152dd1589996cbe08812b03b01d4d41cddc3de03-196x170.svg?q=75)

### Vercel & Kernel: Web Bot Auth for AI agents on the internet

Product

](/blog/webbotauth)[

![Vibium & Kernel: WebDriver BiDi support for cloud browsers](https://cdn.sanity.io/images/7o5bsuld/production/16d456bc022fbf68ebb0a9a9e0ee5e542d012311-149x128.svg?q=75)

### Vibium & Kernel: WebDriver BiDi support for cloud browsers

Product

](/blog/bidi)[

![Kernel x Vercel: Building the Infrastructure Layer for the AI Cloud](https://cdn.sanity.io/images/7o5bsuld/production/44fbe4b6da0d4c2fb3e13d479d14df9a62f241ff-80x46.svg?q=75)

### Kernel x Vercel: Building the Infrastructure Layer for the AI Cloud

Product

](/blog/kernel-vercel)
