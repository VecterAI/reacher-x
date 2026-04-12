# Node.js SDK

A Node.js wrapper for API to manage messaging, mail and calendars.

\*Feature available for :**LinkedIn, WhatsApp, Instagram, Messenger, Telegram, Google, Microsoft, IMAP, X (Twitter)\***

# Introduction

Unipile Node.js SDK is a package written in Typescript that will facilitate the use of API.

[Github repository](https://github.com/unipile/unipile-node-sdk).

# Requirements

Node 20 recommended.

# Installation

```
  npm install unipile-node-sdk
```

# Example usage

More detailed examples are available on GitHub Readme

```javascript
import { UnipileClient } from "unipile-node-sdk";

const client = new UnipileClient("https://{YOUR_DSN}", "{YOUR_ACCESS_TOKEN}");

//LINKEDIN
await client.account.connectLinkedin({
  username: "your LinkedIn username",
  password: "your LinkedIn password",
});

//INSTAGRAM
await client.account.connectInstagram({
  username: "your Instagram username",
  password: "your Instagram password",
});

//WHATSAPP
const { qrCodeString: whatsappQrCode } = await client.account.connectWhatsapp();
console.log(whatsappQrCode); // scan the QR code to finish the connection

//TELEGRAM
const { qrCodeString: telegramQrCode } = await client.account.connectTelegram();
console.log(telegramQrCode); // scan the QR code to finish the connection

//MESSENGER
await client.account.connectMessenger({
  username: "your Messenger username",
  password: "your Messenger password",
});

const chats = await client.messaging.getAllChats();
const messages = await client.messaging.getAllMessages();
const attendees = await client.messaging.getAllAttendees();
```
