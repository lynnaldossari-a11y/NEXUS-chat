# Nexus Social Chat Platform

## Overview
Nexus is a real-time social chat app built with a lightweight HTML/CSS/JavaScript frontend and Supabase for authentication, database storage, and realtime updates.

## Project Structure
- index.html — main chat experience and authentication UI
- styles.css — shared styling, responsive layout, and theme variables
- app.js — Supabase client setup, chat logic, profile handling, and moderation features
- patch-notes.html — public patch notes page
- admin.html — admin information page
- supabase-schema.sql — database schema, policies, and realtime setup

## Current Features
- User login/register flow
- Real-time chat messaging
- Private chat rooms
- Profile settings with avatar support
- Sticker support
- Admin-related UI actions
- Responsive layout for desktop and mobile

## Supabase Setup
The app uses:
- Supabase URL: https://srlfmbtnhbwzxppgwktl.supabase.co
- Supabase anon key: provided in app.js

The database schema in supabase-schema.sql creates:
- accounts
- messages
- rooms
- stickers
- friends
- friend_requests
- banned_users

## Planned Enhancements
The following features are intended for future implementation:
- Custom sticker creation and management
- Friend list system with add/remove actions
- Photo and video sharing
- Admin and owner moderation tools
  - ban users
  - mute users for a period of time
  - wipe chat rooms
- Message delete button for users
- Theme selection for users
- Performance optimizations for lighter and faster loading
- Better compatibility across mobile, tablet, and desktop

## Development Notes
- The frontend is intentionally lightweight and modular.
- All shared styles live in styles.css.
- Supabase queries are handled from app.js.
- The SQL script is designed to be rerun safely for repeated setup.

## Running Locally
1. Open the project folder in a browser, or serve it with a simple local server.
2. Ensure the Supabase credentials in app.js are correct.
3. Run the SQL schema in the Supabase SQL editor.

## Maintenance Tips
- Keep UI changes in styles.css.
- Keep app behavior in app.js.
- Keep database changes in supabase-schema.sql.
- Update this file whenever new features are added.
