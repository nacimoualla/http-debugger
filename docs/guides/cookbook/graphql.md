---
title: GraphQL Request/Response Capture
---

# Recipe: GraphQL Request/Response Capture

## Problem

GraphQL requests are POST requests with JSON bodies containing `query`, `variables`, and `operationName`. Standard loggers only show the POST URL, not the actual GraphQL operation.

## Solution

http-debugger captures the full request body (including GraphQL query) and response body. The dashboard shows parsed JSON so you can inspect the operation name, variables, and response data.

## Code

### Apollo Server (Express)

```ts
import express from 'express'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { httpDebugger } from 'http-debugger/express'

const app = express()

// httpDebugger MUST come before express.json() for body capture
app.use(httpDebugger({ maxBodySize: 4096 }))
app.use(express.json())

const server = new ApolloServer({
  typeDefs: `
    type Query {
      user(id: ID!): User
      users: [User!]!
    }
    type User {
      id: ID!
      name: String!
      email: String!
    }
  `,
  resolvers: {
    Query: {
      user: (_, { id }) => ({ id, name: 'Alice', email: 'alice@example.com' }),
      users: () => [{ id: '1', name: 'Alice', email: 'alice@example.com' }]
    }
  }
})

await server.start()
app.use('/graphql', expressMiddleware(server))

app.listen(3000, () => console.log('Server ready at http://localhost:3000/graphql'))
```

### GraphQL Yoga (Hono)

```ts
import { Hono } from 'hono'
import { createYoga } from 'graphql-yoga'
import { httpDebugger } from 'http-debugger/hono'

const yoga = createYoga({
  schema: `
    type Query {
      user(id: ID!): User
    }
    type User {
      id: ID!
      name: String!
      email: String!
    }
  `,
  resolvers: {
    Query: {
      user: (_, { id }) => ({ id, name: 'Alice', email: 'alice@example.com' })
    }
  }
})

const app = new Hono()
app.use('*', httpDebugger({ maxBodySize: 4096 }))
app.all('/graphql', (c) => yoga.fetch(c.req.raw))
app.get('/graphql', (c) => yoga.fetch(c.req.raw))

export default app
```

### Next.js App Router

```ts
// app/api/graphql/route.ts
import { withHttpDebugger } from 'http-debugger/next'
import { createYoga } from 'graphql-yoga'

const yoga = createYoga({
  schema: `
    type Query {
      user(id: ID!): User
    }
    type User {
      id: ID!
      name: String!
      email: String!
    }
  `,
  resolvers: {
    Query: {
      user: (_, { id }) => ({ id, name: 'Alice', email: 'alice@example.com' })
    }
  }
})

export const GET = withHttpDebugger(yoga.fetch, { maxBodySize: 4096 })
export const POST = withHttpDebugger(yoga.fetch, { maxBodySize: 4096 })
```

## Dashboard Result

The dashboard shows:

**Request:**
```json
{
  "query": "query GetUser($id: ID!) { user(id: $id) { id name email } }",
  "variables": { "id": "1" },
  "operationName": "GetUser"
}
```

**Response:**
```json
{
  "data": {
    "user": { "id": "1", "name": "Alice", "email": "alice@example.com" }
  }
}
```

**Timing breakdown:**
- Headers: 0.5ms
- Body Read: 1.2ms (GraphQL parsing)
- Handler: 8.3ms (resolver execution)
- Response: 2.1ms (serialization)

## Generated cURL

```bash
curl -X POST 'http://localhost:3000/graphql' \
  -H 'content-type: application/json' \
  -d '{"query":"query GetUser($id: ID!) { user(id: $id) { id name email } }","variables":{"id":"1"},"operationName":"GetUser"}'
```

## Tips

1. **Increase `maxBodySize`** — GraphQL queries with variables can exceed 1KB default
2. **Filter health checks** — Exclude introspection queries in development:
   ```ts
   httpDebugger({
     filter: (entry) => !entry.request.body?.query?.includes('__schema')
   })
   ```
3. **Batch queries** — Each batched operation appears as a single entry with multiple operations in the body
4. **Persisted queries** — If using Automatic Persisted Queries (APQ), the request body contains `extensions.persistedQuery.sha256Hash` — http-debugger captures this automatically