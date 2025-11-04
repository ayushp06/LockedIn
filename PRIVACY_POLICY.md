# Privacy Policy for LockedIn

**Last Updated:** November 4, 2025

## Overview
LockedIn ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our Chrome extension.

## Information We Collect

### 1. Personal Information
- **Google Account Information**: When you sign in, we collect:
  - Email address
  - Display name
  - Profile picture (if available)
  - Google User ID

### 2. Usage Data
- **Work Time Tracking**: Time spent on websites you designate as "work sites"
- **Website URLs**: Only for sites you've added to your work sites list
- **Daily Statistics**: Aggregated work time and productivity metrics
- **Achievement Data**: Streaks, goals achieved, and leaderboard rankings

### 3. Social Features
- **Friend Connections**: Email addresses of users you add as friends
- **Leaderboard Data**: Your productivity stats shared with friends

### 4. Data Access Disclosure
- LockedIn reads the URLs of websites you explicitly add to your work sites list in order to measure active time spent on those pages.
- No page content, keystrokes, or other personal data are read, stored, or transmitted.

### 5. Content Script Injection Policy
- **LockedIn does NOT inject content scripts on all websites**
- Content scripts are ONLY injected on websites that YOU explicitly add to your "work sites" list
- When you add a new work site, the extension requests permission for that specific domain
- You can remove sites at any time, which also removes the content script and revokes permissions
- Content scripts only track page visibility (whether the tab is active) - no page content is accessed

## How We Use Your Information

We use the collected information to:
- Authenticate your identity via Google OAuth
- Track and display your productivity metrics
- Calculate daily goals and achievement streaks
- Enable social features (leaderboards, friend comparisons)
- Sync your data across devices
- Improve the extension's functionality

## Data Storage

- All data is stored securely in **Firebase Firestore** (Google Cloud Platform)
- Data is encrypted in transit and at rest
- We implement industry-standard security measures
- Your data is associated with your Google User ID

## Data Sharing

We **DO NOT**:
- Sell your personal information to third parties
- Share your data with advertisers
- Use your data for purposes other than stated above

We **ONLY** share:
- Your productivity stats with friends you've explicitly added
- Aggregated, anonymized data for leaderboards (only with your friends)

## Google Sign-In and OAuth Scopes

### Why We Request Google Sign-In:
LockedIn uses Google Sign-In to provide you with a seamless authentication experience and to sync your productivity data across devices. We request the following OAuth scopes:

- **`userinfo.email`**: To uniquely identify your account and enable friend connections via email
- **`userinfo.profile`**: To display your name and profile picture in the extension and on leaderboards
- **`openid`**: For secure authentication with Google's OAuth 2.0 system

**Your Google credentials are never stored or accessed by us.** Authentication is handled entirely by Google's secure OAuth system. We only receive a secure token to verify your identity.

## Third-Party Services

We use the following third-party services:
- **Google OAuth** - For secure authentication and user identity verification
- **Firebase Authentication** - For user management and session handling
- **Firebase Firestore** - For cloud database storage (see "What Data is Stored in Firebase" below)
- **Google Cloud Platform** - For hosting Firebase services

These services have their own privacy policies:
- [Google Privacy Policy](https://policies.google.com/privacy)
- [Firebase Privacy Policy](https://firebase.google.com/support/privacy)

## What Data is Stored in Firebase

Firebase (Google Cloud Firestore) is used to store and sync your productivity data. Specifically, we store:

### In Firebase Firestore:
- **User Profile**: Email, display name, profile picture URL, user ID, daily goal settings
- **Daily Statistics**: Date, total work time, goal achievement status, streak count
- **Work Sessions**: Timestamps and duration of work sessions (no URLs or page content)
- **Social Data**: Friend connections (user IDs only), leaderboard rankings
- **Achievement Data**: Milestones, badges, and productivity metrics

### What is NOT Stored:
- ❌ Browsing history or URLs visited
- ❌ Page content, text, or HTML
- ❌ Keystrokes or input data
- ❌ Cookies or tracking data
- ❌ Any data from sites not on your work sites list

**Firebase Security**: All data is encrypted in transit (HTTPS) and at rest. We implement Firebase Security Rules to ensure only you can access your own data (except leaderboard data shared with friends).

## Your Rights

You have the right to:
- **Access** your data at any time through the extension
- **Delete** your account and all associated data
- **Export** your data (contact us)
- **Revoke** Google sign-in permissions at any time
- **Remove** friends and control who sees your data

## Data Retention

- Active accounts: Data retained as long as you use the extension
- Inactive accounts: Data retained for 90 days of inactivity
- Deleted accounts: All data permanently deleted within 30 days

## Children's Privacy

LockedIn is not intended for users under 13 years of age. We do not knowingly collect information from children under 13.

## Changes to Privacy Policy

We may update this Privacy Policy periodically. Changes will be posted here with an updated "Last Updated" date. Continued use of the extension after changes constitutes acceptance.

## Contact Us

If you have questions about this Privacy Policy or your data:
- **Email**: [apandejee006@yahoo.com]
- **GitHub**: [github.com/ayushp06]

## Permissions Justification

### Why We Need Each Permission:

- **tabs**: To detect which websites you're actively using for work time tracking (URL detection only, no content access)
- **storage**: To save your settings and work sites list locally on your device
- **activeTab**: To identify the current website for tracking purposes
- **identity**: For secure Google OAuth authentication (sign-in only)
- **idle**: To detect when you're away from your computer and pause time tracking (prevents counting away time)
- **scripting**: To dynamically inject content scripts ONLY on sites you add to your work list (not used until you add a site)
- **optional_host_permissions (https://*/*, http://*/*)**: 
  - These permissions are OPTIONAL and NOT automatically granted
  - When you add a website to your work sites list, the extension requests permission for ONLY that specific domain
  - The extension will prompt you to allow access each time you add a new site
  - You maintain full control - permissions are never granted without your explicit approval
  - Removing a site from your list also revokes its permissions and removes the content script

## Data Security

We implement security measures including:
- Secure HTTPS connections
- Firebase security rules
- Token-based authentication
- Regular security audits
- No storage of sensitive credentials

## Transparency
- LockedIn does not collect browsing history, cookies, or any content from the pages you visit.  
- The extension only records time spent on user-designated domains for productivity tracking purposes.

## Your Consent

By using LockedIn, you consent to this Privacy Policy and agree to its terms.

---

**LockedIn Extension** - Track productivity, achieve more.

