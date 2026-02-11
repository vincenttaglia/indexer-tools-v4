import { GraphQLClient } from 'graphql-request'

/**
 * Creates a GraphQL client configured for a Graphman API endpoint.
 * Graphman endpoints require bearer token authentication.
 *
 * @param endpoint - The Graphman API URL
 * @param token - Bearer token for authentication
 * @returns A configured GraphQLClient instance
 */
export function createGraphmanClient(endpoint: string, token: string): GraphQLClient {
  return new GraphQLClient(endpoint, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
}
