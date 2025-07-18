# AI Agent App

An intelligent document assistant powered by Cloudflare AutoRAG with Fireflies.ai meeting transcription integration.

## Features

- 🤖 **AI-Powered Chat Interface** - Query your documents using natural language
- 📄 **Document Search** - Powered by Cloudflare AutoRAG for intelligent document retrieval
- 🎙️ **Meeting Sync** - Automatically sync and index Fireflies.ai meeting transcripts
- 📊 **Analytics Dashboard** - Track usage metrics and activity
- 🎨 **Modern UI** - Built with Next.js 15, React 19, and Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI
- **Backend**: Next.js API Routes
- **Cloud Services**: 
  - Cloudflare AutoRAG (AI document search)
  - Cloudflare R2 (document storage)
  - Fireflies.ai (meeting transcriptions)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Cloudflare account with AutoRAG enabled
- Fireflies.ai account (for meeting sync)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ai-agent-app.git
cd ai-agent-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file with:
```env
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
FIREFLIES_API_KEY=your_fireflies_api_key
R2_BUCKET_NAME=your_r2_bucket_name
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
ai-agent-app/
├── app/                  # Next.js app directory
│   ├── api/             # API routes
│   │   ├── chat/        # Chat endpoint for AutoRAG
│   │   └── sync-meetings/ # Fireflies sync endpoint
│   └── page.tsx         # Main page
├── components/          # React components
│   ├── chat/           # Chat interface components
│   └── dashboard/      # Analytics dashboard
├── lib/                # Utility functions
└── public/             # Static assets
```

## Usage

### Chat Interface
Ask questions about your documents in natural language. The AI will search through your indexed documents and provide relevant answers.

### Meeting Sync
Click the "Sync Meetings" button to fetch your latest Fireflies transcripts, convert them to markdown, and index them for search.

## Deployment

This app is configured for deployment on Cloudflare Workers:

```bash
npm run build
npx wrangler deploy
```

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

MIT