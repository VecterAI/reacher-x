# Vercel & Kernel: Web Bot Auth for AI agents on the internet | Kernel Blog

february

ProductCatherine Juecopy link

# Vercel & Kernel: Web Bot Auth for AI agents on the internet

We’re partnering with Vercel to support the adoption of Web Bot Auth, a new standard for agent identity.

For AI agents to be really useful, they need secure access to the internet. But today, most websites can’t tell the difference between a “good bot” and a “bad bot.” That’s why we’re excited to partner with Vercel to support the adoption of Web Bot Auth.

## What is Web Bot Auth?

Web Bot Auth began as an [IETF proposal](https://datatracker.ietf.org/doc/html/draft-meunier-web-bot-auth-architecture) with the idea of enabling agents to sign every HTTP request using HTTP message signatures, with keys discoverable through a public directory. It’s quickly becoming the standard way for agents to establish identity.

Think of it as a passport for agents. Hosting providers in front of websites act as border control, checking these passports. You can either use your own keys on Kernel to sign requests, or, soon, rely on Kernel’s default keys, which services like Vercel verify before passing your trusted requests through to the sites they host.

## Web Bot Auth-aware directories

Public Web Bot Auth directories are starting to pop up at these major hosting providers that already sit in front of a huge portion of the internet. Vercel and others use these directories to look up your agent’s public key, verify the signature on each request, and only allow verified agents to bypass bot filters.

We’re already listed in [Vercel’s directory](https://bots.fyi/?query=kernel) as of today, and our registration with several others are currently pending approval.

![](https://cdn.sanity.io/images/7o5bsuld/production/c0535a4a7a9a354f6f4160101a21f587ab925edc-2004x1334.png?q=75)

## Going beyond good bot vs bad bot

While Web Bot Auth solves the problem of identifying a “good bot,” it doesn’t solve the problem of accessing data behind logins and managing credentials. That’s why in the winter, we released a private beta of a standardized way to let agents log in and stay logged in across the internet. We’ll have more to share soon.

In the meantime, if you’re exploring the future of agent identity, we’d love to collaborate. Reach out to partnerships@kernel.sh. And if you want to learn more about how to get started with Web Bot Auth, checkout out our [docs](https://www.kernel.sh/docs/browsers/bot-detection/web-bot-auth).

## more blog posts

[view all](/blog)

[

![Introducing Managed Auth](https://cdn.sanity.io/images/7o5bsuld/production/0473315293bc5568716ad72f839b89120b845881-98x170.svg?q=75)

### Introducing Managed Auth

Product

](/blog/auth)[

![Vibium & Kernel: WebDriver BiDi support for cloud browsers](https://cdn.sanity.io/images/7o5bsuld/production/16d456bc022fbf68ebb0a9a9e0ee5e542d012311-149x128.svg?q=75)

### Vibium & Kernel: WebDriver BiDi support for cloud browsers

Product

](/blog/bidi)[

![Kernel x Vercel: Building the Infrastructure Layer for the AI Cloud](https://cdn.sanity.io/images/7o5bsuld/production/44fbe4b6da0d4c2fb3e13d479d14df9a62f241ff-80x46.svg?q=75)

### Kernel x Vercel: Building the Infrastructure Layer for the AI Cloud

Product

](/blog/kernel-vercel)
