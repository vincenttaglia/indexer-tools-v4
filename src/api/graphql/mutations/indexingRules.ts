import { gql, type GraphQLClient } from 'graphql-request'
import type { IndexingRule, IndexingRuleInput, IndexingRuleIdentifier } from '@/types'

// ---------------------------------------------------------------------------
// Query Documents
// ---------------------------------------------------------------------------

/** Queries indexing rules from the agent, optionally filtered by protocolNetwork. */
export const INDEXING_RULES_QUERY = gql`
  query indexingRules($protocolNetwork: String) {
    indexingRules(protocolNetwork: $protocolNetwork) {
      identifier
      identifierType
      decisionBasis
      protocolNetwork
    }
  }
`

// ---------------------------------------------------------------------------
// Mutation Documents
// ---------------------------------------------------------------------------

/** Sets (creates or updates) an indexing rule. */
export const SET_INDEXING_RULE_MUTATION = gql`
  mutation setIndexingRule($rule: IndexingRuleInput!) {
    setIndexingRule(rule: $rule) {
      identifier
      identifierType
      decisionBasis
      protocolNetwork
    }
  }
`

/** Deletes an indexing rule. Returns true on success. */
export const DELETE_INDEXING_RULE_MUTATION = gql`
  mutation deleteIndexingRule($identifier: IndexingRuleIdentifier!) {
    deleteIndexingRule(identifier: $identifier)
  }
`

// ---------------------------------------------------------------------------
// Typed fetch / mutate functions
// ---------------------------------------------------------------------------

interface IndexingRulesResponse {
  indexingRules: IndexingRule[]
}

interface SetIndexingRuleResponse {
  setIndexingRule: IndexingRule
}

interface DeleteIndexingRuleResponse {
  deleteIndexingRule: boolean
}

/** Fetches indexing rules from the agent, optionally filtered by network. */
export async function fetchIndexingRules(
  client: GraphQLClient,
  protocolNetwork?: string,
): Promise<IndexingRule[]> {
  const variables: Record<string, unknown> = {}
  if (protocolNetwork) {
    variables.protocolNetwork = protocolNetwork
  }
  const data = await client.request<IndexingRulesResponse>(INDEXING_RULES_QUERY, variables)
  return data.indexingRules
}

/** Sets an indexing rule (create or update). */
export async function setIndexingRule(
  client: GraphQLClient,
  rule: IndexingRuleInput,
): Promise<IndexingRule> {
  const data = await client.request<SetIndexingRuleResponse>(SET_INDEXING_RULE_MUTATION, { rule })
  return data.setIndexingRule
}

/** Deletes an indexing rule. Returns true on success. */
export async function deleteIndexingRule(
  client: GraphQLClient,
  identifier: IndexingRuleIdentifier,
): Promise<boolean> {
  const data = await client.request<DeleteIndexingRuleResponse>(DELETE_INDEXING_RULE_MUTATION, {
    identifier,
  })
  return data.deleteIndexingRule
}
