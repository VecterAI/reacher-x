# Getting Started

# What is Unipile?

Unipile is an innovative API designed to provide seamless integrations of various messaging and communication channels into your software applications.

With Unipile, you can effortlessly incorporate messaging services from popular platforms such as WhatsApp, LinkedIn, Instagram and Telegram.

And we also provide comprehensive email integration with all providers, including Google, Microsoft, and IMAP.

Moreover, our roadmap includes plans to support additional features like SMS/RCS and contacts in the near future.

# How can Unipile help ?

Avoid the complexities of building messaging functionality from scratch and reduce development time and costs by leveraging Unipile's ready-made API. With few calls, you can setup within your UI:

- **Centralise messages history on a contact**: Use Unipile to retrieve the history of a conversation with a contact, whatever the messaging provider it is
- **Notify new messages**: With webhooks, you can receive new messages and emails in real-time
- **Send messages**: Send messages to your users contact list or email to any recipient. You can also initiate new 1to1 chat from your app
- **Invite contact**: Send invitations to contact to join your user network or create an outreach sequence
- **Get contact information**: Get user's profile, status relation, fetch posts from a person or a company...

# How to test ? Create a Unipile Account

To access the API and start exploring Unipile's messaging or emails capabilities, please follow these steps:

1. Create an account on [API Dashboard Signup](https://dashboard.unipile.com/signup).
2. Log in to [API Dashboard ](https://dashboard.unipile.com/login) and get **your DSN (Data Source Name)** which **must be used by for your requests**.

<Image align="center" src="https://files.readme.io/51ab224-Screenshot_2023-12-01_at_17.21.47.png" />

3. Generate an Access Token : [Generate a token](https://dashboard.unipile.com/access-tokens)
4. On the "Accounts" page, you can connect accounts to test directly API call for sending and receiving messages, bypassing the API account adding process for moment.
5. After that, you can experiment with every feature without writing a single line of code directly in the "[API Reference](https://developer.unipile.com/reference)" section of the documentation. Specify **your DSN** and **your token** for the route you wish to use, and then interactively fill in the parameters.

# Quick start video

✅ In this video, you’ll learn:

- How to connect a provider account (LinkedIn, WhatsApp, Gmail…)
- How to list all chats (GET /api/v1/chats)
- How to send a message in a chat (POST /api/v1/chats/:chatId/messages)

<Embed url="https://www.youtube.com/watch?v=9e3LNkOfAyY" href="https://www.youtube.com/watch?v=9e3LNkOfAyY" typeOfEmbed="youtube" html="%3Ciframe%20class%3D%22embedly-embed%22%20src%3D%22%2F%2Fcdn.embedly.com%2Fwidgets%2Fmedia.html%3Fsrc%3Dhttps%253A%252F%252Fwww.youtube.com%252Fembed%252F9e3LNkOfAyY%253Ffeature%253Doembed%26display_name%3DYouTube%26url%3Dhttps%253A%252F%252Fwww.youtube.com%252Fwatch%253Fv%253D9e3LNkOfAyY%26image%3Dhttps%253A%252F%252Fi.ytimg.com%252Fvi%252F9e3LNkOfAyY%252Fhqdefault.jpg%26type%3Dtext%252Fhtml%26schema%3Dyoutube%22%20width%3D%22854%22%20height%3D%22480%22%20scrolling%3D%22no%22%20title%3D%22YouTube%20embed%22%20frameborder%3D%220%22%20allow%3D%22autoplay%3B%20fullscreen%3B%20encrypted-media%3B%20picture-in-picture%3B%22%20allowfullscreen%3D%22true%22%3E%3C%2Fiframe%3E" />
