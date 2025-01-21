import { useState } from 'react'
import { Button } from './ui/button'

export default function Workflow() {
  const [isCreating, setIsCreating] = useState(false)
  const [workflowName, setWorkflowName] = useState('')
  const [steps, setSteps] = useState([
    { 
      id: 1, 
      description: 'Customer Creates Ticket', 
      isFixed: true,
      hooks: []
    },
  ])
  const [newStep, setNewStep] = useState('')

  const handleCreateClick = () => {
    setIsCreating(true)
  }

  const handleAddStep = () => {
    if (newStep.trim()) {
      setSteps([...steps, { 
        id: steps.length + 1, 
        description: newStep.trim(),
        isFixed: false,
        hooks: []
      }])
      setNewStep('')
    }
  }

  const handleRemoveStep = (stepId) => {
    setSteps(steps.filter(step => !step.isFixed && step.id !== stepId))
  }

  const handleAddHook = (stepId) => {
    setSteps(steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          hooks: [...step.hooks, {
            id: step.hooks.length + 1,
            type: 'email',
            config: { recipient: '' }
          }]
        }
      }
      return step
    }))
  }

  const handleUpdateHook = (stepId, hookId, hookData) => {
    setSteps(steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          hooks: step.hooks.map(hook => 
            hook.id === hookId ? { ...hook, ...hookData } : hook
          )
        }
      }
      return step
    }))
  }

  const handleRemoveHook = (stepId, hookId) => {
    setSteps(steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          hooks: step.hooks.filter(hook => hook.id !== hookId)
        }
      }
      return step
    }))
  }

  const handleSaveWorkflow = () => {
    // Here we'll add the save logic later
    console.log('Saving workflow:', { 
      name: workflowName, 
      steps: steps.map(step => ({
        description: step.description,
        isFixed: step.isFixed,
        hooks: step.hooks
      }))
    })
    setIsCreating(false)
  }

  return (
    <div style={{
      border: '2px solid purple',
      backgroundColor: 'lavender',
      padding: '20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Workflow Manager</h2>
        {!isCreating && (
          <Button onClick={handleCreateClick}>
            Create New Workflow
          </Button>
        )}
      </div>

      {isCreating ? (
        <div style={{ 
          border: '1px solid purple',
          padding: '15px',
          backgroundColor: 'white'
        }}>
          <h3>Create New Workflow</h3>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Workflow Name:</label>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              style={{ 
                width: '100%',
                padding: '8px',
                border: '1px solid purple',
                borderRadius: '4px'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <h4>Steps:</h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {steps.map((step) => (
                <li key={step.id} style={{ 
                  marginBottom: '15px',
                  padding: '10px',
                  backgroundColor: step.isFixed ? 'lavender' : 'white',
                  border: '1px solid purple',
                  borderRadius: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                    <span>{step.description}</span>
                    {!step.isFixed && (
                      <Button 
                        onClick={() => handleRemoveStep(step.id)}
                        style={{ marginLeft: 'auto' }}
                      >
                        Remove Step
                      </Button>
                    )}
                  </div>
                  
                  <div style={{ marginLeft: '20px' }}>
                    <h5 style={{ marginBottom: '10px' }}>Hooks:</h5>
                    {step.hooks.map(hook => (
                      <div key={hook.id} style={{ 
                        marginBottom: '10px',
                        padding: '10px',
                        border: '1px dashed purple',
                        borderRadius: '4px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                          <select
                            value={hook.type}
                            onChange={(e) => handleUpdateHook(step.id, hook.id, { type: e.target.value })}
                            style={{ marginRight: '10px' }}
                          >
                            <option value="email">Email</option>
                            <option value="notification">Notification</option>
                            <option value="webhook">Webhook</option>
                          </select>
                          <Button 
                            onClick={() => handleRemoveHook(step.id, hook.id)}
                            style={{ marginLeft: 'auto' }}
                          >
                            Remove Hook
                          </Button>
                        </div>
                        {hook.type === 'email' && (
                          <input
                            type="email"
                            value={hook.config.recipient}
                            onChange={(e) => handleUpdateHook(step.id, hook.id, { 
                              config: { ...hook.config, recipient: e.target.value }
                            })}
                            placeholder="Enter email recipient"
                            style={{ 
                              width: '100%',
                              padding: '8px',
                              border: '1px solid purple',
                              borderRadius: '4px'
                            }}
                          />
                        )}
                      </div>
                    ))}
                    <Button onClick={() => handleAddHook(step.id)}>
                      Add Hook
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <input
                type="text"
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                placeholder="Enter new step"
                style={{ 
                  flex: 1,
                  padding: '8px',
                  border: '1px solid purple',
                  borderRadius: '4px'
                }}
              />
              <Button onClick={handleAddStep}>Add Step</Button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button onClick={handleSaveWorkflow}>Save Workflow</Button>
          </div>
        </div>
      ) : (
        <div>
          <h3>Active Workflows</h3>
          <ul>
            <li>Customer Onboarding</li>
            <li>Support Ticket Flow</li>
            <li>Sales Pipeline</li>
          </ul>
        </div>
      )}
    </div>
  )
} 