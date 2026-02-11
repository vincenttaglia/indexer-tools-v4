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

  return new GraphQLClient(url, { headers })
}
