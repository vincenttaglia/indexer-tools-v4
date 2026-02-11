import { GraphQLClient } from 'graphql-request'

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
    // The indexer agent may return partial errors alongside valid data.
    // 'all' prevents graphql-request from throwing ClientError on responses
    // that contain both data and errors (e.g. warnings, partial failures).
    errorPolicy: 'all',
  })
}
