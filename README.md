# Syllabus Extractor

A Next.js application that automatically extracts assignments, exams, projects, and important dates from syllabus PDFs using Google's Gemini AI. Perfect for importing academic deadlines into your calendar app.

## Features

- Drag and drop syllabus PDF upload
- AI-powered extraction of academic deadlines and events
- Structured JSON output with assignments, exams, and projects
- **NEW**: Humorous audio summaries using ElevenLabs text-to-speech
- Real-time processing status with visual feedback
- Clean, responsive UI with dark mode support
- Automatic date formatting (YYYY-MM-DD) for calendar integration
- Audio playback controls with play/pause functionality

## Getting Started

### Prerequisites


1. Install and run [Ollama](https://ollama.com/) locally.
2. Pull the models used for extraction and summaries:

```bash
ollama pull llama3.1:8b
```

3. Get a Groq API key.
4. Create a `.env.local` file in the root directory with your local AI and TTS settings:

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EXTRACTION_MODEL=llama3.1:8b
OLLAMA_SUMMARY_MODEL=llama3.1:8b
GROQ_API_KEY=your_groq_api_key_here
GROQ_TTS_MODEL=canopylabs/orpheus-v1-english
GROQ_TTS_VOICE=hannah
GROQ_TTS_RESPONSE_FORMAT=wav
```

### Installation

First, install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1. Upload a syllabus PDF by dragging and dropping it onto the upload area or clicking "Choose Syllabus PDF"
2. Click "Extract Syllabus Data" to analyze the document
3. View the structured extraction with assignments, exams, and projects
4. Copy the JSON data to import into your calendar app

## Extracted Data Structure

The application extracts the following information:
- **Course Details**: Name, code, professor info, office hours
- **Assignments**: Title, due date, description
- **Exams**: Type (Midterm/Final/Quiz), date, description  
- **Projects**: Title, due date, description
- **Class Schedule**: Meeting times and locations

## API Endpoints

- `POST /api/process-pdf` - Processes uploaded syllabus PDFs and returns structured JSON data

## Learn More



To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
