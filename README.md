# Chic Move Out

Project Manifesto & Goal: I am moving out of my apartment and need to rehome my belongings before I leave. I am building a custom, mobile-first "Moving Sale & Silent Auction" app for my friends. The goal is to turn a stressful moving clear-out into a fun, stylish social event.

Core Mechanics: * Item Types: Items are categorized (bedroom, kitchen, etc.) and have two distinct natures: "Auction" (blind bidding) or "Free" (first-come, first-grab). * User Journey: Friends sign up simply with their name and phone number. For auctions, it is a silent format: they can only bid once, and they cannot see the current highest price or who else has bid. They will only see a social proof indicator of how many people have bid.

Design Principles: The design must be light, chic, and colorful. Think of a high-end aesthetic lifestyle magazine. Use plenty of whitespace, clean sans-serif typography, and vibrant pastel accents. Avoid heavy e-commerce UI elements or cluttered dashboards.Global Design Directives:

Vibe: Light, chic, playful, and modern (think high-end boutique or an aesthetic lifestyle magazine).

Colors: A clean off-white background with vibrant, colorful accents for categories and buttons (e.g., pastel matcha green, soft tangerine, lilac).

UI Elements: Large, high-quality image cards with soft rounded corners. Use a modern, geometric sans-serif font. No heavy drop shadows.

App Vision: Build a mobile-first web app for a personal "Moving Sale & Silent Auction."

Database Schema (Supabase):

Users: Name, Phone Number.

Items: Title, Photo URL, Category (Bedroom, Kitchen, Living Room, etc.), Type ('Auction' or 'Free'), Description, Status ('Available', 'Claimed/Sold').

Bids: Item ID, User ID, Bid Amount, Timestamp.

Core Features (Phase 1):

Auth: A simple, chic sign-up screen asking only for Name and Phone Number.

Home Feed: A beautiful masonry or grid layout of all available items. Users can filter by Category (pill-shaped toggles at the top) and Type (Auction vs. Free).

Admin View: A hidden dashboard just for me where I can upload a photo, select a category, and choose if it's "Auction" or "Free."

Step 2: The Core Logic (Bidding & Claiming)

Once the layout looks gorgeous and you can upload an item, we wire up the rules of the game.

Copy and paste this into Lovable:

Now let's implement the core interaction logic for the "Moving Sale" app.

Logic Branch A: "Auction" Items (Silent Auction)

When a user clicks an Auction item, they see the image and description.

They see an input field to enter their $ bid and a "Submit Blind Bid" button.

Crucial Constraints: A user can only submit ONE bid per item. They cannot see the current highest price or who else has bid.

Social Proof: Display a dynamic text indicator saying: "🔥 [X] friends have placed a bid!" (pulling from the total count of bids on that item).

Once they bid, the button changes to a disabled state saying "Bid Locked In."

Logic Branch B: "Free" Items (First Come, First Served)

When a user clicks a Free item, they see a single, prominent button: "Claim It!"

Crucial Constraints: The moment one user clicks it, the item's Status immediately changes to 'Claimed'. The button disappears for everyone else, and the item card gets a chic "Claimed by [User Name]" overlay.

Step 3: The AI Admin Assistant (Auto-Descriptions)

Finally, we add the AI layer to save you hours of typing out dimensions and material descriptions.

Copy and paste this into Lovable:

Let's upgrade the Admin Upload view with an AI workflow. I want to minimize my data entry when adding items.

Feature Update: AI Description Generation

In the Admin upload form, after I upload a photo and enter a basic Title (e.g., "Muji Oak Desk"), add a magic sparkle button next to the Description box.

When clicked, send the Title and the Image to the built-in AI model (e.g., Gemini 1.5 Flash/Pro with vision capabilities).

System Prompt for AI: "You are a chic interior design copywriter. Look at this image and the title. Write a short, punchy, and enticing 2-sentence description of the item to help sell it to friends at a moving sale. Keep the tone light, aesthetic, and fun."

The generated text should auto-populate the Description text area, allowing me to manually edit it before hitting "Publish Item."

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://rehome-auction.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9f119cb6-3518-4808-b0d7-540e0450e629).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
