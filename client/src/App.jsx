import React, { useState, useEffect, useRef, isValidElement, cloneElement, Children } from 'react';
import Draggable from 'react-draggable';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import './App.css';

const TaskItem = ({ task, onStop, onToggle, onDelete, onUpdateContent }) => {
  const nodeRef = useRef(null);

  const handleCheckboxClick = (lineIndex, checked) => {
    const lines = task.content.split('\n');
    const targetLine = lines[lineIndex - 1];

    if (!targetLine) return;

    let newLine = targetLine;
    if (targetLine.includes('[ ]')) {
      newLine = targetLine.replace('[ ]', '[x]');
    } else if (targetLine.includes('[x]')) {
      newLine = targetLine.replace('[x]', '[ ]');
    }

    lines[lineIndex - 1] = newLine;
    const newContent = lines.join('\n');

    onUpdateContent(task.id, newContent);
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      defaultPosition={{ x: task.x, y: task.y }}
      onStop={(e, data) => onStop(e, data, task.id)}
    >
      <div
        ref={nodeRef}
        className={`task-card ${task.isCompleted ? 'completed' : ''}`}
      >
        <div className="task-header">
          <span className="deadline-text">
            {task.deadline 
              ? `LIMIT: ${new Date(task.deadline).toLocaleString('ja-JP')}` 
              : 'NO LIMIT'}
          </span>
          <button 
            className="delete-btn"
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} 
          >
            ×
          </button>
        </div>

        <div className="task-content" onMouseDown={(e) => e.stopPropagation()}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              li: ({ node, children, ...props }) => {
                const line = node?.position?.start?.line;

                const childrenWithHandler = Children.map(children, (child) => {
                  if (
                    isValidElement(child) && 
                    child.props && 
                    child.props.type === 'checkbox'
                  ) {
                    return cloneElement(child, {
                      onChange: (e) => {
                        if (line) handleCheckboxClick(line, e.target.checked);
                      },
                      style: { cursor: 'pointer' },
                      disabled: false
                    });
                  }
                  return child;
                });

                return <li {...props}>{childrenWithHandler}</li>;
              }
            }}
          >
            {task.content}
          </ReactMarkdown>
        </div>

        <div className="task-actions">
          <button 
            className="toggle-btn"
            onClick={(e) => { e.stopPropagation(); onToggle(task.id, task.isCompleted); }}
          >
            {task.isCompleted ? 'RESTORE' : 'COMPLETE'}
          </button>
        </div>
      </div>
    </Draggable>
  );
};

function App() {
  const [tasks, setTasks] = useState([]);
  const [newTaskContent, setNewTaskContent] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isInputOpen, setIsInputOpen] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await axios.get('/api/tasks');
      setTasks(res.data);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    }
  };

  const addTask = async () => {
    if (!newTaskContent) return;
    try {
      const res = await axios.post('/api/tasks', {
        content: newTaskContent,
        x: 100 + Math.random() * 50,
        y: 100 + Math.random() * 50,
        deadline: deadline || null,
        shameMessage: "手汗で滑って手を繋げない",
        webhookUrl: ""
      });
      setTasks([...tasks, res.data]);
      setNewTaskContent('');
      setDeadline('');
      setIsInputOpen(false);
    } catch (err) {
      console.error("Error adding task:", err);
    }
  };

  const handleStop = async (e, data, id) => {
    try {
      await axios.patch(`/api/tasks/${id}`, { x: data.x, y: data.y });
    } catch (err) {
      console.error("Error updating position:", err);
    }
  };

  const toggleComplete = async (id, currentStatus) => {
    try {
      const res = await axios.patch(`/api/tasks/${id}`, { isCompleted: !currentStatus });
      setTasks(tasks.map(t => t.id === id ? { ...t, isCompleted: res.data.isCompleted } : t));
    } catch (err) {
      console.error("Error toggling complete:", err);
    }
  };

  const deleteTask = async (id) => {
    if(!confirm("タスクを消滅させますか？")) return;
    try {
      await axios.delete(`/api/tasks/${id}`);
      setTasks(tasks.filter(t => t.id !== id));
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  const updateTaskContent = async (id, newContent) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, content: newContent } : t));

    try {
        await axios.patch(`/api/tasks/${id}`, { content: newContent });
    } catch (err) {
      console.error("Error updating content:", err);
    }
  };

  return (
    <div className="app-container">
      <div className="create-btn-container">
        <button className="create-btn" onClick={() => setIsInputOpen(!isInputOpen)}>
          {isInputOpen ? 'CLOSE SYSTEM' : '＋ NEW PROTOCOL'}
        </button>
        
        {isInputOpen && (
          <div className="input-panel">
            <textarea 
              placeholder="Enter Task Protocol..." 
              value={newTaskContent}
              onChange={(e) => setNewTaskContent(e.target.value)}
              rows={3}
            />
            <input 
              type="datetime-local" 
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <button className="add-confirm-btn" onClick={addTask}>EXECUTE</button>
          </div>
        )}
      </div>

      {tasks.map((task) => (
        <TaskItem 
          key={task.id} 
          task={task} 
          onStop={handleStop} 
          onToggle={toggleComplete} 
          onDelete={deleteTask} 
          onUpdateContent={updateTaskContent}
        />
      ))}
    </div>
  );
}

export default App;