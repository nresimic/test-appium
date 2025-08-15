# Agent Orchestration Guidelines for Vault22 Testing

## Available Agents and Their Purposes

### write-test
**Purpose**: Write test code using documented flows
**Use when**: 
- After ios-app-navigator has documented a flow
- Need to convert flow documentation to actual test code
- Creating e2e tests from recorded interactions

**Key responsibilities**:
- Read flow documentation from test-flows/documented-flows/
- Create test files following established patterns
- Update flow-registry.yaml when test is implemented

### ios-app-navigator
**Purpose**: Navigate app and document flows with all selectors
**Use when**:
- User asks to "create test for X"
- Need to explore app features
- Recording user journeys
- Finding accessibility IDs

**Key responsibilities**:
- Navigate through the app
- Document every interaction and element
- Save flow to test-flows/documented-flows/
- Identify missing or problematic selectors

**Test Data for Vault22**:
- Login phone: 569661789
- OTP code: 0000
- Passcode: 0000

## Orchestration Patterns

### Creating Tests for Features
When user says "create test for [feature]":

1. **First**: Use ios-app-navigator to explore and document the flow
   - Navigate through the feature
   - Document each step with accessibility IDs
   - Save flow to test-flows/documented-flows/[flow-name].yaml
   - Update flow-registry.yaml with status: "documented"

2. **Then**: Use test-architect (write-test agent) to create the test
   - Read the documented flow
   - Use exact selectors from flow documentation
   - Create test following established patterns
   - Update flow-registry.yaml with status: "implemented"

### Verifying App Flows
When user says "check if [flow] works":

1. Use ios-app-navigator to navigate through flow and document it

### Finding Elements
When user says "find [element] in the app":

1. Use ios-app-navigator to find and document the element with its accessibility ID

## Decision Rules

- **"Create test"** → First ios-app-navigator (document flow), then test-architect (write test)
- **"Navigate app"** or **"Check app flow"** → Use ios-app-navigator
- **"Verify flow"** → Use ios-app-navigator with test data
- **"Document flow"** → Use ios-app-navigator

## Important Notes

1. Agents cannot call other agents directly - orchestration happens at the main assistant level
2. Always collect outputs from each agent before proceeding to the next
3. ios-app-navigator documents flows → test-architect writes tests from documentation
4. Use the provided test data (phone: 569661789, OTP: 0000, Passcode: 0000) for consistent testing

## Test File Locations

- Test files: `/test/e2e/` and `/test/screens/`
- Screen objects: `/test/screens/*.screen.ts`
- Test utilities: `/test/utils/`
- Test data: `/test/data/`