export const capitalize = (value: string): string => {
    return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : ''
}

export const uncapitalize = (value: string): string => {
    return value.length > 0 ? value.charAt(0).toLowerCase() + value.slice(1) : ''
}
