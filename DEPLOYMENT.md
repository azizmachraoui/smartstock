# SmartStock Deployment Guide

This guide provides step-by-step instructions to deploy **SmartStock** to production using **MongoDB Atlas**, **Render** (Node.js/Express API + Socket.IO), and **Vercel** (React/Vite SPA).

---

## 1. Prerequisites

Before starting, ensure you have free accounts on:
1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. [Render](https://render.com)
3. [Vercel](https://vercel.com)
4. GitHub (repository hosting)

---

## 2. Step 1: MongoDB Atlas (Database)

1. **Create a Free Cluster**:
   - Log into MongoDB Atlas.
   - Click **Create Database** -> Choose the **M0 Free Tier**.
   - Select your preferred cloud provider and region (e.g. AWS / us-east-1).

2. **Configure Database User**:
   - Go to **Security** -> **Database Access**.
   - Click **Add New Database User**.
   - Choose **Password** authentication.
   - Enter a username (e.g., `smartstock_user`) and a secure password.
   - Under **Database User Privileges**, select **Read and write to any database**.

3. **Configure Network Access**:
   - Go to **Security** -> **Network Access**.
   - Click **Add IP Address**.
   - Select **Allow Access from Anywhere** (`0.0.0.0/0`) so Render instances can connect dynamically.

4. **Copy Connection String**:
   - In **Database** -> **Clusters**, click **Connect**.
   - Select **Drivers** (Node.js).
   - Copy your connection string:
     ```text
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/smartstock?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your actual credentials.

---

## 3. Step 2: Render (Backend API + Socket.IO)

1. **Create Web Service**:
   - Log into Render and click **New +** -> **Web Service**.
   - Connect your GitHub repository (`smartstock`).
   - Fill in service settings:
     - **Name**: `smartstock-api`
     - **Region**: Choose region closest to your MongoDB Atlas cluster.
     - **Branch**: `main` (or `feature/web-redesign`)
     - **Root Directory**: Leave blank (monorepo root).
     - **Runtime**: `Node`
     - **Build Command**:
       ```bash
       npm install && npm run build:shared && npm run build:api
       ```
     - **Start Command**:
       ```bash
       npm run start -w @smartstock/api
       ```
     - **Instance Type**: `Free`

2. **Set Environment Variables in Render**:
   Under the **Environment** tab, add:

   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Enables production optimizations |
   | `PORT` | `10000` | Port automatically assigned by Render |
   | `MONGODB_URI` | `mongodb+srv://...` | Your MongoDB Atlas connection string |
   | `JWT_ACCESS_SECRET` | *At least 32 characters random string* | Sign access tokens |
   | `JWT_REFRESH_SECRET` | *At least 32 characters random string* | Sign refresh tokens |
   | `CLIENT_URL` | `https://<your-vercel-app>.vercel.app` | Vercel production frontend URL |
   | `CORS_ORIGIN` | `https://<your-vercel-app>.vercel.app` | Allowed CORS origins for REST & Socket |

   > **Tip**: Generate 32+ character secrets easily in your terminal:
   > ```bash
   > node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   > ```

3. **Deploy & Seed**:
   - Click **Create Web Service**.
   - Once deployed, your API URL will be: `https://smartstock-api.onrender.com`.
   - Verify health: Open `https://smartstock-api.onrender.com/health` in your browser. You should receive:
     ```json
     { "status": "ok", "database": "connected", "timestamp": "..." }
     ```
   - **Seed Initial Data**:
     In Render, go to **Shell** tab and run:
     ```bash
     npm run seed
     ```
     This seeds categories, suppliers, initial inventory products, demo purchase orders, and the demo accounts:
     - **Admin**: `admin@smartstock.dev` / `Passw0rd!`
     - **Manager**: `manager@smartstock.dev` / `Passw0rd!`
     - **Employee**: `employee@smartstock.dev` / `Passw0rd!`

> **Note on Render Free Tier**: Free web services spin down after 15 minutes of inactivity. When a request arrives, Render may take 30–50 seconds to spin up.

---

## 4. Step 3: Vercel (Frontend Web App)

1. **Import Project**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New** -> **Project**.
   - Import your GitHub repository (`smartstock`).

2. **Configure Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Edit and set to `apps/web`.
   - **Build Command**:
     ```bash
     cd ../.. && npm run build:shared && cd apps/web && npm run build
     ```
     *(Or leave default if Monorepo root is configured with npm workspaces)*
   - **Output Directory**: `dist`

3. **Environment Variables**:
   Add the following variables in Vercel:

   | Key | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://smartstock-api.onrender.com/api` |
   | `VITE_SOCKET_URL` | `https://smartstock-api.onrender.com` |

4. **Deploy**:
   - Click **Deploy**.
   - Vercel will build the frontend and provide your production URL (e.g. `https://smartstock-web.vercel.app`).

5. **Update Render CORS**:
   - Once you have the Vercel URL, go back to Render and update `CLIENT_URL` and `CORS_ORIGIN` with your actual Vercel URL.
   - Click **Save Changes** in Render to trigger an instant redeploy.

---

## 5. Post-Deployment Verification Checklist

Once both services are running, run through this checklist:

- [ ] **Health Check**: `GET https://smartstock-api.onrender.com/health` returns `status: "ok"` and `database: "connected"`.
- [ ] **SPA Direct Deep Linking**: Navigate to `https://smartstock-web.vercel.app/products` and press browser refresh. The page should load without 404 (handled by `vercel.json`).
- [ ] **Authentication**: Log in with demo credentials (`admin@smartstock.dev` / `Passw0rd!`).
- [ ] **CRUD Flow**: Create a category, add a supplier, and create a product.
- [ ] **Real-Time WebSocket**: Open the web application in two browser windows side-by-side:
  - Check the socket status indicator in the top right (green dot = connected via WSS).
  - Modify stock or update an order in Tab A.
  - Observe instant query invalidation and subtle highlight in Tab B without refreshing.
- [ ] **Security**: Inspect browser network console: no JWT secrets or passwords logged.
