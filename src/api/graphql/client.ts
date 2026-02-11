import { GraphQLClient } from 'graphql-request'

/**
 * Custom JSON serializer that strips `"errors": null` from GraphQL responses.
 *
 * The Indexer Agent returns `{ "data": {...}, "errors": null }` in its responses.
 * graphql-request v7 considers `null` invalid for the `errors` field (it expects
 * an array, object, or undefined) and throws:
 *   "Invalid execution result: errors is not plain object OR array"
 *
 * This serializer removes the `errors` key when its value is `null` during JSON
 * parsing, before graphql-request validates the response shape.
 */
const agentJsonSerializer = {
  stringify: JSON.stringify,
  parse: (text: string) => {
    const parsed = JSON.parse(text)
    // Strip `"errors": null` at the top level — graphql-request chokes on it
    if (parsed && typeof parsed === 'object' && 'errors' in parsed && parsed.errors === null) {
      delete parsed.errors
    }
    return parsed
  },
}

/**
 * Factory for creating GraphQL clients.
 *
 * @param url - The GraphQL endpoint URL
 * @param token - Optional bearer token for authenticated endpoints (e.g., indexer agent)
 * @returns A configured GraphQLClient instance
 */
export function createGraphQLClient(url: string, token?: string): GraphQLClient {
  const headers: Record<string, string> = {}

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return new GraphQLClient(url, {
    headers,
    jsonSerializer: agentJsonSerializer,
  })
}
