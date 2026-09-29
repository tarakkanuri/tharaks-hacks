# Tharak's Hacks — Public Deployment

This project is a Node.js + Express + Socket.IO app.

## Run locally

Install Node.js 18+.

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Deploy publicly with Render

Render can host this Node/Express server and gives it a public `onrender.com` URL. Your computer does **not** need to stay on and you do **not** need to keep Command Prompt open.

### 1. Put this project on GitHub

Create a new GitHub repository and upload all files in this project, including `package.json`, `server.js`, `public/`, and `render.yaml`.

Do not upload `node_modules` or private secrets.

### 2. Create the Render service

In Render:

- New → Web Service
- Connect your GitHub repository
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

Render will provide a public URL such as:

```text
https://tharaks-hacks.onrender.com
```

The exact hostname is chosen by Render and may differ from this example.

### 3. Important: persistent data

The app now supports `DATA_DIR`. If you want sessions and uploaded photos to survive server restarts/deploys, attach a Render Persistent Disk and mount it at:

```text
/var/data
```

The app then stores:

```text
/var/data/sessions.json
/var/data/photos/
```

Render persistent disks are available on paid services. Without one, Render's default filesystem is ephemeral, so locally stored photos/session data can be lost after a restart or redeploy.

### 4. Your public birthday link

After the Render deployment is live, open the public site and generate a session. The generated URL will be based on the Render domain, for example:

```text
https://YOUR-RENDER-DOMAIN.onrender.com/birthday/SESSION_ID
```

Share that URL with participants.

## Cloudflare custom domain (optional)

If you own a domain managed by Cloudflare, you can add a custom domain to the Render service. You do not need a Cloudflare Tunnel when the app itself is already hosted on Render.

## Privacy

This application requests browser camera, microphone, and location permissions and supports automatic photo capture after explicit participant consent. Use it only with informed consent and follow applicable privacy laws and event rules. Do not attempt to bypass browser permission controls or conceal recording.
