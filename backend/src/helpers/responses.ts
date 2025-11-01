/**
 * Standard Response Helpers
 * Consistent response formatting across all routes
 */

/**
 * Success response (200 OK)
 */
export function successResponse<T>(message: string, data?: T) {
  return {
    success: true,
    message,
    ...(data !== undefined && { data }),
  }
}

/**
 * Created response (201 Created)
 */
export function createdResponse<T>(message: string, data?: T) {
  return {
    success: true,
    message,
    ...(data !== undefined && { data }),
  }
}

/**
 * Deleted response (200 OK)
 */
export function deletedResponse(resourceName: string, count: number = 1) {
  const plural = count !== 1
  return {
    success: true,
    message: `${count} ${resourceName}${plural ? 's' : ''} deleted successfully`,
    count,
  }
}

/**
 * Updated response (200 OK)
 */
export function updatedResponse<T>(resourceName: string, data?: T) {
  return {
    success: true,
    message: `${resourceName} updated successfully`,
    ...(data !== undefined && { data }),
  }
}

/**
 * Error response
 * Note: Fastify's error handling will set the status code
 */
export function errorResponse(message: string, code?: string, details?: any) {
  return {
    success: false,
    error: message,
    ...(code && { code }),
    ...(details && { details }),
  }
}

/**
 * Paginated response
 * Standard format for list endpoints
 */
export interface PaginationMetadata {
  count: number
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationMetadata
) {
  return {
    data,
    pagination,
  }
}

/**
 * Not found response
 */
export function notFoundResponse(resourceName: string) {
  return {
    success: false,
    error: `${resourceName} not found`,
  }
}

/**
 * Forbidden response
 */
export function forbiddenResponse(message: string = 'Access denied') {
  return {
    success: false,
    error: message,
  }
}

/**
 * Validation error response
 */
export function validationErrorResponse(errors: Array<{ field: string; message: string }>) {
  return {
    success: false,
    error: 'Validation failed',
    validationErrors: errors,
  }
}
