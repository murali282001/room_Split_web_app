import { format, formatDistanceToNow, isToday, isPast, isFuture, parseISO } from 'date-fns'

export const formatDate = (d: string): string => format(parseISO(d), 'dd MMM yyyy')

export const formatDateTime = (d: string): string =>
  format(parseISO(d), 'dd MMM yyyy, h:mm a')

export const timeAgo = (d: string): string =>
  formatDistanceToNow(parseISO(d), { addSuffix: true })

export const isOverdue = (dueDate: string): boolean =>
  isPast(parseISO(dueDate)) && !isToday(parseISO(dueDate))

export const isDueToday = (dueDate: string): boolean => isToday(parseISO(dueDate))

export const isDueFuture = (dueDate: string): boolean => isFuture(parseISO(dueDate))

export const formatMonth = (d: string): string => format(parseISO(d), 'MMM yyyy')

export const formatShortDate = (d: string): string => format(parseISO(d), 'dd MMM')
