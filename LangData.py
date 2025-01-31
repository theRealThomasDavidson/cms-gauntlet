from langsmith import Client
from dotenv import load_dotenv
import os
import numpy as np
from datetime import datetime
import json

# Load environment variables from .env file
load_dotenv()

LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY")
LANGSMITH_PROJECT = os.getenv("LANGSMITH_PROJECT")

# Initialize client with API key from environment
client = Client(
    api_key=LANGSMITH_API_KEY
)

# Get the project ID
project = client.read_project(project_name=LANGSMITH_PROJECT)

# Get runs from the project
runs = client.list_runs(
    project_id=project.id,
    execution_order=1, 
)

# Initialize data structures for each input type
input_types = {}  # Will hold latencies and annotations for each input type

for run in runs:
    try:
        # Get success status
        success = bool(int(run.feedback_stats["works"]["avg"]))
        
        # Get message content
        message_content = run.inputs["messages"][0][1]["kwargs"]["content"]
        
        # Determine type (stage transition or response generation)
        run_type = "stage_transition" if "What stage should this ticket be in?" in message_content else "response_generation"
        
        if run_type not in input_types:
            input_types[run_type] = {
                'latencies': [],
                'total_annotations': 0,
                'yes_annotations': 0,
                'runs': []
            }
            
        # Calculate latency
        latency = (run.end_time - run.start_time).total_seconds() * 1000
        input_types[run_type]['latencies'].append(latency)
        input_types[run_type]['total_annotations'] += 1
        if success:
            input_types[run_type]['yes_annotations'] += 1
            
        # Store run data
        input_types[run_type]['runs'].append({
            'content': message_content,
            'success': success,
            'latency': latency,
            'timestamp': run.start_time.isoformat()
        })
            
    except Exception as e:
        print(f"Error processing run: {str(e)}")
        continue

# Calculate statistics for each input type
stats = {}
for input_type, data in input_types.items():
    latencies = np.array(data['latencies'])
    stats[input_type] = {
        'latency_stats': {
            'mean_ms': float(np.mean(latencies)) if len(latencies) > 0 else 0,
            'median_ms': float(np.median(latencies)) if len(latencies) > 0 else 0,
            'p95_ms': float(np.percentile(latencies, 95)) if len(latencies) > 0 else 0,
            'p99_ms': float(np.percentile(latencies, 99)) if len(latencies) > 0 else 0,
            'min_ms': float(np.min(latencies)) if len(latencies) > 0 else 0,
            'max_ms': float(np.max(latencies)) if len(latencies) > 0 else 0,
            'total_runs': len(latencies)
        },
        'annotation_stats': {
            'total_annotations': data['total_annotations'],
            'yes_annotations': data['yes_annotations'],
            'yes_percentage': (data['yes_annotations'] / data['total_annotations'] * 100) 
                if data['total_annotations'] > 0 else 0
        }
    }

# Print statistics for each input type
for input_type, stat in stats.items():
    print(f"\n=== Statistics for {input_type} ===")
    print("\nLatency Statistics:")
    print(f"Total runs: {stat['latency_stats']['total_runs']}")
    print(f"Mean: {stat['latency_stats']['mean_ms']:.2f}ms")
    print(f"Median: {stat['latency_stats']['median_ms']:.2f}ms")
    print(f"95th percentile: {stat['latency_stats']['p95_ms']:.2f}ms")
    print(f"99th percentile: {stat['latency_stats']['p99_ms']:.2f}ms")
    print(f"Min: {stat['latency_stats']['min_ms']:.2f}ms")
    print(f"Max: {stat['latency_stats']['max_ms']:.2f}ms")
    
    print("\nAccuracy Statistics:")
    print(f"Total runs: {stat['annotation_stats']['total_annotations']}")
    print(f"Successful runs: {stat['annotation_stats']['yes_annotations']}")
    print(f"Success rate: {stat['annotation_stats']['yes_percentage']:.1f}%")

# Save everything to file
with open('langsmith_data.json', 'w') as f:
    json.dump({
        'input_types': input_types,
        'statistics': stats,
        'metadata': {
            'project': LANGSMITH_PROJECT,
            'generated_at': datetime.now().isoformat(),
            'total_runs': len(list(runs))
        }
    }, f, indent=2, default=str)
