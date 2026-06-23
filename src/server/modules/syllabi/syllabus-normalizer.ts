import type {
  ClassMeetingItem,
  ExamItem,
  HomeworkItem,
  OfficeHourItem,
  ParsedSyllabusResponse,
  PipelineWarning,
  ProjectItem,
} from './syllabus-types';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validIsoDate(value?: string): boolean {
  if (!value || !ISO_DATE_PATTERN.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function cleanDate(value: unknown, field: string, warnings: PipelineWarning[]): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;

  const trimmedValue = value.trim();
  if (validIsoDate(trimmedValue)) return trimmedValue;

  warnings.push({
    field,
    message: `Date "${trimmedValue}" was not valid YYYY-MM-DD and requires review.`,
  });
  return undefined;
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeHomework(items: unknown, warnings: PipelineWarning[]): HomeworkItem[] {
  return ensureArray<HomeworkItem>(items).map((item, index) => ({
    ...item,
    due_date: cleanDate(item.due_date, `homework[${index}].due_date`, warnings),
  }));
}

function normalizeExams(items: unknown, warnings: PipelineWarning[]): ExamItem[] {
  return ensureArray<ExamItem>(items).map((item, index) => ({
    ...item,
    date: cleanDate(item.date, `exams[${index}].date`, warnings),
  }));
}

function normalizeProjects(items: unknown, warnings: PipelineWarning[]): ProjectItem[] {
  return ensureArray<ProjectItem>(items).map((item, index) => ({
    ...item,
    due_date: cleanDate(item.due_date, `projects[${index}].due_date`, warnings),
  }));
}

function normalizeOfficeHours(items: unknown, warnings: PipelineWarning[]): OfficeHourItem[] {
  return ensureArray<OfficeHourItem>(items).map((item, index) => ({
    ...item,
    start_date: cleanDate(item.start_date, `office_hours[${index}].start_date`, warnings),
    end_date: cleanDate(item.end_date, `office_hours[${index}].end_date`, warnings),
  }));
}

function normalizeClassMeetings(items: unknown, warnings: PipelineWarning[]): ClassMeetingItem[] {
  return ensureArray<ClassMeetingItem>(items).map((item, index) => ({
    ...item,
    days: Array.isArray(item.days) ? item.days : typeof item.days === 'string' ? [item.days] : [],
    start_date: cleanDate(item.start_date, `class_meetings[${index}].start_date`, warnings),
    end_date: cleanDate(item.end_date, `class_meetings[${index}].end_date`, warnings),
  }));
}

export function normalizeSyllabusResponse(data: ParsedSyllabusResponse): {
  syllabus: ParsedSyllabusResponse;
  warnings: PipelineWarning[];
} {
  const warnings: PipelineWarning[] = [];

  return {
    syllabus: {
      course_name: typeof data.course_name === 'string' ? data.course_name : undefined,
      course_code: typeof data.course_code === 'string' ? data.course_code : undefined,
      professor: typeof data.professor === 'object' && data.professor !== null ? data.professor : undefined,
      class_schedule: typeof data.class_schedule === 'string' ? data.class_schedule : undefined,
      homework: normalizeHomework(data.homework, warnings),
      exams: normalizeExams(data.exams, warnings),
      projects: normalizeProjects(data.projects, warnings),
      office_hours: normalizeOfficeHours(data.office_hours, warnings),
      class_meetings: normalizeClassMeetings(data.class_meetings, warnings),
    },
    warnings,
  };
}
