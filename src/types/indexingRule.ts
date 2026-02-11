export type IndexingDecisionBasis = 'rules' | 'never' | 'always' | 'offchain'
export type IdentifierType = 'deployment' | 'subgraph' | 'group'

/** Indexing rule as returned by the Indexer Agent Admin API */
export interface IndexingRule {
  identifier: string
  identifierType: IdentifierType
  decisionBasis: IndexingDecisionBasis
  protocolNetwork: string
}

/** Input for creating/updating an indexing rule */
export interface IndexingRuleInput {
  identifier: string
  identifierType: IdentifierType
  decisionBasis: IndexingDecisionBasis
  protocolNetwork: string
}

/** Identifier for deleting an indexing rule */
export interface IndexingRuleIdentifier {
  identifier: string
  protocolNetwork: string
}
