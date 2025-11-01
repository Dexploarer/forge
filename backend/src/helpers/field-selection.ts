/**
 * Field Selection Helper
 * Filter object fields based on user-requested field list
 */

/**
 * Filter object fields based on comma-separated field list
 * Always includes 'id' field for consistency
 *
 * @param data - Single object or array of objects to filter
 * @param fieldsParam - Comma-separated string of field names (e.g., "id,name,status")
 * @param allowedFields - Optional whitelist of allowed fields for security
 * @returns Filtered data with only requested fields (or all fields if no selection)
 *
 * @example
 * // Single object
 * const filtered = applyFieldSelection(project, "id,name,status", ['id', 'name', 'status', 'ownerId'])
 *
 * @example
 * // Array of objects
 * const filtered = applyFieldSelection(projects, "id,name", ['id', 'name', 'description'])
 */
export function applyFieldSelection<T extends Record<string, any>>(
  data: T | T[],
  fieldsParam?: string,
  allowedFields?: string[]
): T | T[] | Partial<T> | Partial<T>[] {
  // If no field selection requested, return all data
  if (!fieldsParam) return data

  const selectedFields = fieldsParam.split(',').map((f) => f.trim())
  const isArray = Array.isArray(data)
  const items = isArray ? data : [data]

  const filterFields = (obj: T): Partial<T> => {
    const filtered: Partial<T> = { id: obj.id } as unknown as Partial<T>

    selectedFields.forEach((field) => {
      // Check if field is in allowed list (if whitelist provided)
      const isAllowed = !allowedFields || allowedFields.includes(field)

      // Add field if allowed and exists in object
      if (isAllowed && field in obj) {
        (filtered as any)[field] = obj[field as keyof T]
      }
    })

    return filtered
  }

  const result = items.map(filterFields)
  return isArray ? result : (result[0] as Partial<T>)!
}

/**
 * Get list of allowed fields for a resource type
 * Use this to define field whitelists consistently
 */
export function getCommonFields(): string[] {
  return ['id', 'name', 'description', 'status', 'createdAt', 'updatedAt']
}

/**
 * Validate field selection against allowed fields
 * Returns validation result with errors
 */
export function validateFieldSelection(
  fieldsParam: string,
  allowedFields: string[]
): { valid: boolean; invalidFields: string[] } {
  const selectedFields = fieldsParam.split(',').map((f) => f.trim())
  const invalidFields = selectedFields.filter((field) => !allowedFields.includes(field))

  return {
    valid: invalidFields.length === 0,
    invalidFields,
  }
}
