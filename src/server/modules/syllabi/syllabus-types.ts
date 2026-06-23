export type HomeworkItem = { title?: string; due_date?: string; due_time?: string; description?: string };
export type ExamItem = { type?: string; date?: string; time?: string; description?: string };
export type ProjectItem = { title?: string; due_date?: string; due_time?: string; description?: string };

export type OfficeHourItem = {
  day?: string;
  time?: string;
  location?: string;
  recurrence?: string;
  start_date?: string;
  end_date?: string;
};

export type ClassMeetingItem = {
  days?: string[] | string;
  time?: string;
  location?: string;
  recurrence?: string;
  start_date?: string;
  end_date?: string;
};

export type ParsedSyllabusResponse = {
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

export type PipelineWarning = {
  field?: string;
  message: string;
};
