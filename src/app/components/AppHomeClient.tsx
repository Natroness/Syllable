'use client';

import { useState, useRef } from 'react';
import FileUpload from './FileUpload';
import FileInfo from './FileInfo';
import ProcessButton from './ProcessButton';
import ErrorDisplay from './ErrorDisplay';
import SyllabusResults from './SyllabusResults';

type SyllabusData = {
  course_name?: string;
  course_code?: string;
  professor?: {
    name?: string;
    email?: string;
    office_hours?: string;
  };
  class_schedule?: string;
  homework?: Array<{ title: string; due_date: string; description?: string }>;
  exams?: Array<{ type: string; date: string; description?: string }>;
  projects?: Array<{ title: string; due_date: string; description?: string }>;
};

async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const responseText = await response.text();
  if (!responseText) return fallback;

  try {
    const errorJson = JSON.parse(responseText) as {
      error?: string;
      message?: string;
      details?: {
        ocrMessage?: string;
        parserMessage?: string;
        providerMessage?: string;
        code?: string;
      };
    };
    const baseMessage = errorJson.error || errorJson.message || fallback;
    const detailMessage =
      errorJson.details?.ocrMessage ||
      errorJson.details?.parserMessage ||
      errorJson.details?.providerMessage ||
      errorJson.details?.code;

    return detailMessage ? `${baseMessage} ${detailMessage}` : baseMessage;
  } catch {
    return responseText || fallback;
  }
}

export default function AppHomeClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<SyllabusData | null>(null);
  const [error, setError] = useState<string>('');
  const [isGeneratingHumorous, setIsGeneratingHumorous] = useState<boolean>(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError('');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setResult(null);
      setError('');
    }
  };

  const handleProcessFile = async (): Promise<void> => {
    if (!file) return;
    setIsProcessing(true);
    setError('');
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Failed to process file'));
      }
      const data = await response.json();
      setResult(data.result as SyllabusData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearFile = (): void => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerateHumorousSummary = async (): Promise<void> => {
    if (!file) return;
    setIsGeneratingHumorous(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (result) {
        formData.append('syllabus', JSON.stringify(result));
      }
      const response = await fetch('/api/generate-humorous-summary', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Failed to generate humorous summary'));
      }
      const data = await response.json();
      setIsGeneratingAudio(true);
      setAudioUrl('');
      try {
        const audioResponse = await fetch('/api/generate-audio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: data.result }),
        });
        if (!audioResponse.ok) {
          throw new Error(await getApiErrorMessage(audioResponse, 'Failed to generate audio'));
        }
        const audioBlob = await audioResponse.blob();
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      } catch (e) {
        console.error('Audio generation failed', e);
      } finally {
        setIsGeneratingAudio(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGeneratingHumorous(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="space-y-6">
          <FileUpload
            onFileChange={handleFileChange}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
          {file && (
            <FileInfo
              file={file}
              onRemove={clearFile}
            />
          )}
          {file && (
            <div className="flex items-center justify-center gap-3">
              <ProcessButton
                isProcessing={isProcessing}
                onProcess={handleProcessFile}
              />
              <button
                onClick={handleGenerateHumorousSummary}
                disabled={isGeneratingHumorous}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                {isGeneratingHumorous ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Audio Summary...
                  </>
                ) : (
                  'Generate Audio Summary'
                )}
              </button>
            </div>
          )}
          <ErrorDisplay error={error} />
          {result !== null && (
            <SyllabusResults 
              result={result as SyllabusData} 
              onGenerateHumorousSummary={handleGenerateHumorousSummary}
            />
          )}
          {isGeneratingAudio && (
            <div className="bg-gray-900 text-white rounded-md shadow px-4 py-2 text-sm flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Preparing audio summary...
            </div>
          )}
          {audioUrl && !isGeneratingAudio && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow p-3 w-full">
              <audio controls src={audioUrl} className="w-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
