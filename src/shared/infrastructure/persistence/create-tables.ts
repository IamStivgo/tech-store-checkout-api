import {
  CreateTableCommand,
  ResourceInUseException,
  type CreateTableCommandInput,
  type DynamoDBClient,
} from '@aws-sdk/client-dynamodb';

export type TableCreationOutcome = 'created' | 'already-exists';

/**
 * Creates the given tables, skipping the ones that already exist. Meant for DynamoDB Local
 * only: in AWS the tables belong to Terraform.
 */
export const createTables = async (
  client: DynamoDBClient,
  definitions: readonly CreateTableCommandInput[],
): Promise<Map<string, TableCreationOutcome>> => {
  const outcomes = new Map<string, TableCreationOutcome>();

  for (const definition of definitions) {
    outcomes.set(String(definition.TableName), await createTable(client, definition));
  }

  return outcomes;
};

const createTable = async (
  client: DynamoDBClient,
  definition: CreateTableCommandInput,
): Promise<TableCreationOutcome> => {
  try {
    await client.send(new CreateTableCommand(definition));
    return 'created';
  } catch (error) {
    if (error instanceof ResourceInUseException) {
      return 'already-exists';
    }
    throw error;
  }
};
