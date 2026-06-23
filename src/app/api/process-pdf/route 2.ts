import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Types for parsed AI response
type HomeworkItem = { title?: string; due_date?: string; description?: string };
type ExamItem = { type?: string; date?: string; description?: string };
type ProjectItem = { title?: string; due_date?: string; description?: string };
type OfficeHourItem = {
  day?: string;
  time?: string;
  location?: string;
  recurrence?: string;
  start_date?: string;
  end_date?: string;
};
type ClassMeetingItem = {
  days?: string[] | string;
  time?: string;
  location?: string;
  recurrence?: string;
  start_date?: string;
  end_date?: string;
};

type ParsedResponse = {
  course_name?: string;
  course_code?: string;
  professor?: { name?: string; email?: string; office_hours?: string };
  class_schedule?: string;
  homework?: HomeworkItem[];
  exams?: ExamItem[];
  projects?: ProjectItem[];
  office_hours?: OfficeHourItem[];
  class_meetings?: ClassMeetingItem[];
  [key: string]: unknown;
};

/**
 * API route for processing PDF files with Gemini AI
 * Handles file upload, validation, and AI-powered summarization
 * 
 * @param request - Next.js request object containing the uploaded file
 * @returns JSON response with AI-generated summary or error message
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

    // Prepare content for Gemini AI processing with syllabus extraction prompt
    const prompt = `
    You are a highly accurate syllabus parser. Extract ALL assignments, exams, projects, and important dates from this syllabus PDF.
    
    🎯 CRITICAL DATE EXTRACTION RULES:
    
    1. FIND THE YEAR/SEMESTER FIRST:
       - Look for "Fall 2025", "Spring 2025", "2025", etc. in the syllabus header
       - Determine the correct year from context
       - If year is ambiguous, use the most recent/upcoming year
    
    2. SCAN ALL SECTIONS:
       - Course schedules, calendars, timelines
       - Assignment tables, grading sections
       - Important dates sections
       - Week-by-week schedules
       - Any tables or lists with dates
    
    3. DATE FORMAT HANDLING (convert ALL to YYYY-MM-DD):
       - "August 23, 2025" → "2025-08-23"
       - "Aug 23" → "2025-08-23" (add inferred year)
       - "8/23/2025" → "2025-08-23"
       - "8/23" → "2025-08-23" (add inferred year)
       - "Dec 2" → "2025-12-02" (add inferred year)
       - Date ranges like "8/18-8/22" → use END date "2025-08-22"
       - Week numbers like "Week 3 (Sept 11)" → extract "2025-09-11"
    
    4. VALIDATE ALL DATES:
       - Ensure month is 01-12
       - Ensure day is valid for that month (e.g., no Feb 30)
       - Ensure year is reasonable (2024-2026)
       - NEVER output "Invalid Date" - if unsure, use the closest valid date
    
    5. FIND THESE ITEMS:
       - ✅ ALL homework/assignments (HW1, HW2, Assignment 1, etc.)
       - ✅ ALL exams (Midterm, Final, Quiz 1, Test, Review)
       - ✅ ALL projects (Team Project, Individual Report, Presentation)
       - ✅ Sprint plans, sprint reviews, retrospectives
       - ✅ Surveys, evaluations, peer reviews
       - ✅ Lab work, practicals, workshops
       - ✅ Discussion posts, forums, reflections
       - ✅ Office hours (recurring weekly schedule with day, time, location)
       - ✅ Class meeting times (e.g., "MW 2:00-3:15 PM", "TTh 10:00-11:30 AM")
    
    6. EXTRACT FULL TITLES:
       - Use complete names: "Team Formation and Project Preferences" not "Team"
       - Include numbers: "Sprint 4 Individual Report" not "Individual Report"
       - Keep descriptive details: "Self-intro and Project Preferences"
    
    7. COMMON PATTERNS TO LOOK FOR:
       - "Due:" or "Due by:" or "Due on:"
       - Dates next to assignment names in tables
       - Calendar grids with dates and assignments
       - Timeline formats
       - Parenthetical dates like "Assignment 1 (Sept 15)"
    
    📋 EXAMPLE DATE CONVERSIONS:
    - "Sep 11, 2025" → "2025-09-11"
    - "9/11" with year 2025 → "2025-09-11"
    - "September 11" with year 2025 → "2025-09-11"
    - "Week 1 (Aug 23)" with year 2025 → "2025-08-23"
    
    ⚠️ QUALITY CHECKS BEFORE RETURNING:
    - Did you check EVERY section of the syllabus?
    - Are ALL dates in valid YYYY-MM-DD format?
    - Did you include assignment numbers (Sprint 1, Sprint 2, etc.)?
    - Are there at least 5-10 items if this is a full semester course?
    - Did you check tables, schedules, and calendar sections?
    
    Return ONLY valid JSON in this exact format (no markdown, no extra text, no code blocks):
    {
        "course_name": "Full Course Name",
        "course_code": "Course Code",
        "professor": {
            "name": "Professor Name",
            "email": "email@domain.com",
            "office_hours": "Office hours description"
        },
        "class_schedule": "Class meeting schedule",
        "homework": [
            {
                "title": "Complete Assignment Title",
                "due_date": "YYYY-MM-DD",
                "description": "Assignment description"
            }
        ],
        "exams": [
            {
                "type": "Midterm/Final/Quiz",
                "date": "YYYY-MM-DD",
                "description": "Exam details"
            }
        ],
        "projects": [
            {
                "title": "Complete Project Title",
                "due_date": "YYYY-MM-DD",
                "description": "Project description"
            }
        ],
        "office_hours": [
            {
                "day": "Monday/Tuesday/etc",
                "time": "HH:MM AM/PM - HH:MM AM/PM",
                "location": "Office location or Zoom link",
                "recurrence": "weekly",
                "start_date": "YYYY-MM-DD (first occurrence in semester)",
                "end_date": "YYYY-MM-DD (last occurrence in semester)"
            }
        ],
        "class_meetings": [
            {
                "days": ["Monday", "Wednesday"] or ["Tuesday", "Thursday"],
                "time": "HH:MM AM/PM - HH:MM AM/PM",
                "location": "Classroom location",
                "recurrence": "weekly",
                "start_date": "YYYY-MM-DD (first day of semester)",
                "end_date": "YYYY-MM-DD (last day of semester)"
            }
        ]
    }
    `;

    const contents = [
      { 
        text: prompt
      },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64
        }
      }
    ];

    // Generate AI-powered syllabus extraction using Gemini
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents
    });
    const rawResponse = (result as { text?: string }).text;
    if (!rawResponse) {
      throw new Error('Empty response from AI');
    }

    // Helper function to validate and fix dates
    const validateDate = (dateStr?: string): string => {
      if (!dateStr) return new Date().toISOString().split('T')[0];
      
      // Check if already in valid YYYY-MM-DD format
      const isoMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
      if (isoMatch) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return dateStr;
        }
      }
      
      // Try to parse various formats
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
      
      // If all else fails, return today's date
      console.warn(`Invalid date detected: ${dateStr}, using current date`);
      return new Date().toISOString().split('T')[0];
    };

    // Parse the JSON response from Gemini
    let parsedData: ParsedResponse;
    try {
      // Validate response exists
      if (!rawResponse) {
        throw new Error('No response received from AI');
      }
      
      // Clean the response to extract only JSON (remove any markdown formatting)
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      
      const jsonString = jsonMatch[0];
      parsedData = JSON.parse(jsonString);
      
      // Validate and fix all dates in the parsed data
      if (parsedData.homework && Array.isArray(parsedData.homework)) {
        parsedData.homework = parsedData.homework.map((hw: HomeworkItem): HomeworkItem => ({
          ...hw,
          due_date: validateDate(hw.due_date)
        }));
      }
      
      if (parsedData.exams && Array.isArray(parsedData.exams)) {
        parsedData.exams = parsedData.exams.map((exam: ExamItem): ExamItem => ({
          ...exam,
          date: validateDate(exam.date)
        }));
      }
      
      if (parsedData.projects && Array.isArray(parsedData.projects)) {
        parsedData.projects = parsedData.projects.map((project: ProjectItem): ProjectItem => ({
          ...project,
          due_date: validateDate(project.due_date)
        }));
      }
      
      if (parsedData.office_hours && Array.isArray(parsedData.office_hours)) {
        parsedData.office_hours = parsedData.office_hours.map((oh: OfficeHourItem): OfficeHourItem => ({
          ...oh,
          start_date: validateDate(oh.start_date),
          end_date: validateDate(oh.end_date)
        }));
      }
      
      if (parsedData.class_meetings && Array.isArray(parsedData.class_meetings)) {
        parsedData.class_meetings = parsedData.class_meetings.map((cm: ClassMeetingItem): ClassMeetingItem => ({
          ...cm,
          start_date: validateDate(cm.start_date),
          end_date: validateDate(cm.end_date)
        }));
      }
      
      console.log('Successfully parsed and validated:', {
        courseName: parsedData.course_name,
        assignmentCount: parsedData.homework?.length || 0,
        examCount: parsedData.exams?.length || 0,
        projectCount: parsedData.projects?.length || 0,
        officeHoursCount: parsedData.office_hours?.length || 0,
        classMeetingsCount: parsedData.class_meetings?.length || 0
      });
      
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      return NextResponse.json(
        { 
          error: 'Failed to parse AI response. Please try again.',
          success: false 
        },
        { status: 500 }
      );
    }

    // Return successful response with structured syllabus data
    return NextResponse.json({ 
      result: parsedData,
      success: true 
    });

  } catch (error) {
    // Log error for debugging
    console.error('Error processing PDF with Gemini AI:', error);
    
    // Return user-friendly error message
    return NextResponse.json(
      { 
        error: 'Failed to process PDF. Please try again.',
        success: false 
      },
      { status: 500 }
    );
  }
}
