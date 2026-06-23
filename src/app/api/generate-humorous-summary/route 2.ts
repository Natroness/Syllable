import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

/**
 * API route for generating humorous summaries of syllabus PDFs
 * Creates funny, engaging summaries while maintaining course information
 * 
 * @param request - Next.js request object containing the uploaded file
 * @returns JSON response with humorous summary or error message
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract file from form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    // Validate file presence
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' }, 
        { status: 400 }
      );
    }

    // Validate file type - only PDF files are allowed
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' }, 
        { status: 400 }
      );
    }

    // Validate file size (optional - limit to 10MB)
    const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeInBytes) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' }, 
        { status: 400 }
      );
    }

    // Convert file to base64 for Gemini API
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Validate API key presence
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY environment variable is not set');
      return NextResponse.json(
        { error: 'API configuration error' }, 
        { status: 500 }
      );
    }

    // Initialize Gemini AI client
    const genAI = new GoogleGenAI({ apiKey });

    // Prepare content for humorous summary optimized for ElevenLabs audio generation
    const humorousPrompt = `
    You are Macdonald Trunk, a funny, confident course mentor.
    
    Context:
    - You will receive a single course syllabus as a PDF (binary input). Extract details ONLY from the PDF. Do not invent information.
    
    Goal:
    Write one humorous, motivational, audio-ready summary of the syllabus content.
    
    Voice & Style:
    - Start exactly with: "Hello everyone, Macdonald Trunk here — your favorite course mentor."
    - Conversational, spoken tone (like talking to a friend). Use contractions.
    - Natural speech patterns with brief pauses using ellipses … or — dashes.
    - Keep it 300–450 words (about 2–3 minutes spoken).
    - Plain text only (no Markdown, no emojis).
    
    What to extract from the PDF (if present):
    - Course name/code and professor name
    - Class meeting days/times (schedule)
    - Office hours
    - Major exams and projects (names/dates)
    - Key workload expectations and important policies students care about (attendance, grading highlights, late policy)
    - Survival tips implied by the syllabus (study habits, milestones)
    
    Humor rules:
    - Keep it witty, supportive, never mean-spirited.
    - Use one course-tailored joke if applicable (based on subject inferred from title/sections):
      - Math → "Ah yes, everyone's favorite course — math, where numbers haunt our dreams."
      - CS → "Remember, code never sleeps — but you might want to!"
      - Economics → "Get ready to analyze supply and demand — mostly your supply of sleep."
      - Psychology → "Prepare to psychoanalyze yourself halfway through the semester."
      - Default → "You surely don't want to sleep in this class — trust me."
    
    Audio optimization:
    - Short, punchy sentences. Occasional rhetorical questions.
    - Use ALL CAPS sparingly for emphasis on key points.
    - End with a memorable, encouraging closing line.
    
    Constraints:
    - Replace day abbreviations with full names: Mon→Monday, Tue→Tuesday, Wed→Wednesday, Thu→Thursday, Fri→Friday.
    - Add one humorous acknowledgement that deadlines exist, e.g.:
      "Yes, there are deadlines — so many deadlines my non-existent brain can barely comprehend them!"
    - Preserve factual details (names, times, office hours, exam/project info) exactly as extracted.
    - Do not include refund info or administrative policies not present in the PDF.
    - Do not list raw bullet points; make it flow as spoken narrative.
    - Output plain text only.
    - Do not include your reasoning or chain-of-thought; provide only the final summary.
    
    Ending:
    Finish with something like:
    "Now go out there and make your professors proud — or at least awake!"
    `;

    const contents = [
      { 
        text: humorousPrompt
      },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64
        }
      }
    ];

    // Generate humorous summary using Gemini
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-lite-preview",
      contents: contents
    });
    const rawResponse = result.text;

    // Validate response exists
    if (!rawResponse) {
      throw new Error('No response received from AI');
    }

    // Return successful response with humorous summary
    return NextResponse.json({ 
      result: rawResponse,
      success: true 
    });

  } catch (error) {
    // Log error for debugging
    console.error('Error generating humorous summary:', error);
    
    // Return user-friendly error message
    return NextResponse.json(
      { 
        error: 'Failed to generate humorous summary. Please try again.',
        success: false 
      },
      { status: 500 }
    );
  }
}
