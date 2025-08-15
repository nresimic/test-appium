# Test Flow Documentation System

This directory contains documented app navigation flows that bridge the gap between manual app exploration and automated test creation.

## Directory Structure

```
test-flows/
├── flow-registry.yaml          # Master list of all flows and their status
├── templates/                  # Templates and guidelines
│   └── flow-documentation-template.yaml
├── documented-flows/           # Actual recorded flows
│   └── [flow-name]-[timestamp].yaml
└── README.md
```

## Workflow

### 1. Flow Documentation (ios-app-navigator agent)
- Navigates through the app
- Records every interaction and element
- Saves flow to `documented-flows/`
- Updates `flow-registry.yaml` with status: "documented"

### 2. Test Implementation (write-test agent)
- Checks `flow-registry.yaml` for documented flows
- Reads flow documentation
- Creates automated test using exact selectors
- Updates registry with status: "implemented"

## Flow Status Lifecycle

```
documented → in_progress → implemented
     ↓
  outdated (when app changes)
```

## Status Definitions

- **documented**: Flow has been recorded, ready for test implementation
- **in_progress**: Test is being written
- **implemented**: Test has been created and is in the codebase
- **outdated**: App has changed, flow needs re-recording

## Usage Examples

### For ios-app-navigator agent:
```yaml
# After navigating, save flow:
Location: test-flows/documented-flows/login-flow-20240814-1030.yaml
Update: flow-registry.yaml with new entry
```

### For write-test agent:
```yaml
# Check registry for available flows:
1. Read flow-registry.yaml
2. Find flows with status: "documented"
3. Read the flow file
4. Create test using provided selectors
5. Update status to "implemented"
```

## Key Benefits

1. **Consistency**: All tests follow the same documented flows
2. **Traceability**: Know which flows have tests
3. **Maintenance**: Easy to identify outdated tests
4. **Collaboration**: Clear handoff between agents
5. **Documentation**: Flows serve as test documentation

## Flow Quality Metrics

Each flow includes:
- Total elements found
- Elements with stable IDs
- Problematic selectors
- Stability score (% of stable selectors)

Aim for >80% stability score for reliable tests.