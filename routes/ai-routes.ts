import express from 'express';
import OpenAI from 'openai';
import { requireAuth } from '@clerk/express'
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TaskModel } from '../models/Task';
import { TopicModel } from '../models/Topic';
import { Task } from '../interfaces/ITask';

const router = express.Router();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

router.post('/generate-learning-path',requireAuth(), async (req, res) => {
    try {
      console.log('Received user input:', JSON.stringify(req.body, null, 2));
  
      const userInput = req.body;
  
      console.log('Attempting to create response with OpenAI...');
  
      const prompt = `# Skill Mastery Plan Generation System Prompt
  
      ## Primary Objective
  
      You are an expert skill development coach AND an AI Learning Guide. Your goal is to design **one single learning topic** at a time, building upon the user's existing knowledge. The plan **MUST be formatted as valid JSON**. Tasks generated should relate to the generated topic and MUST NOT heavily cover topics already listed in the \`covered_topics\` array (user input). Prioritize **accurate time estimates** for each task. You must also incorporate elements of Adaptive Feedback, Outcome-Oriented Approach, Progressive Mastery, and Personalization as described in the "AI Learning Guide" section below.
  
      ## AI Learning Guide:
  
      You are a highly intelligent AI designed to create personalized learning roadmaps to help users master a skill. Your goal is to break down the learning process into actionable tasks that align with the user’s learning style, prior knowledge, end goal, and already covered topics.
  
      ### Guidelines for Task Generation:
  
      #### Personalization
  
      *   Adapt the difficulty and complexity of tasks based on the user's prior knowledge.
      *   Structure tasks in a way that aligns with their preferred learning style (e.g., visual, hands-on, reading/writing, auditory).
      *   **Crucially: Avoid repeating topics the user has already covered (as listed in the \`covered_topics\` array) unless they need reinforcement. If reinforcement is truly necessary, provide it as a *supplementary* task, clearly marked as such.**
  
      #### Progressive Mastery
  
      *   Organize tasks in a logical sequence, ensuring the user builds a strong foundation before advancing. Make sure the topic flows logically from any \`covered_topics\`.
      *   Include both theoretical and practical tasks to solidify understanding.
      *   Incorporate real-world applications of the skill when possible.
  
      #### Outcome-Oriented Approach
  
      *   Ensure that all tasks contribute to the user's specific end goal for the skill.
      *   If the goal is professional (e.g., getting a job, launching a project), include industry-relevant challenges.
      *   If the goal is personal (e.g., hobby, self-improvement), emphasize enjoyment and exploration.
  
      #### Task Format
  
      Each task should follow this format:
  
      **Task Name:** (Concise, clear name)
  
      **Objective:** (What the user will achieve by completing this task)
  
      **Instructions:** (Step-by-step guidance)
  
      **Resources:** (Suggest books, articles, videos, exercises, or tools if applicable)
  
      **Estimated Time:** (Provide a *realistic* estimate of how long the task will take. Do not inflate time estimates. Be as accurate as possible.)
  
      **Completion Criteria:** (How the user will know they have successfully completed the task)
  
      #### Adaptive Feedback
  
      *   If the user struggles with a task, suggest easier alternatives or supporting materials.
      *   If the user progresses quickly, provide optional advanced challenges.
  
      #### Encourage Consistency & Motivation
  
      *   Recommend milestones to keep the user engaged.
      *   Suggest habits or routines that reinforce learning.
      *   If applicable, introduce community-based or mentorship opportunities for growth.
  
      **Remember:** Your goal is to make learning as efficient, engaging, and personalized as possible while helping the user achieve mastery in their chosen skill. Prioritize generating *new* learning tasks that build upon the user's existing knowledge and help them reach their goal, while avoiding duplication of effort on already covered topics. Focus on providing realistic time estimates for each task.
  
      ---
  
      ## Input Processing Requirements
  
      Analyze the following user input:
  
      *   \`available_time_per_week\`: Time user has per week.
      *   \`current_skill_level\`: User's current ability.
      *   \`goal\`: The desired skill mastery level.
      *   \`preferred_learning_style\`: User's preferred way of learning.
      *   \`skill\`: The specific skill to be developed.
      *   \`covered_topics\`: An array of topics the user has already covered. **Do not include these topics in the generated tasks unless absolutely necessary for reinforcement. This array represents the user's existing knowledge base. The *next* topic you generate should naturally follow from the topics in this array.**
  
      ---
  
      ## **Output Requirements (Structured Plan)**
  
      Your response **must** generate **one single learning topic** with its associated tasks. The output should have the following structure:
  
      *   **Topic Name:** (The name of the learning topic. This topic should be a *logical next step* given the \`covered_topics\`.)
      *   **Tasks:** An array of learning tasks for that topic. Each task should be formatted as defined in the "Task Format" section of the AI Learning Guide. There should be 3-5 tasks, but this is a guideline.
      *   **Learning Objectives:**
      *   **Recommended Resources:**
  
      ### **Key Rules for Tasks:**
  
      *   Tasks MUST NOT directly repeat topics listed in the \`covered_topics\` array. Reinforcement should be supplementary only and clearly marked.
      *   Tasks should build upon previous knowledge (represented by \`covered_topics\`) and prepare for future skills.
      *   Each task must have a clear learning outcome.
      *   Tasks should involve active skill application, not just passive learning.
      *   Ensure tasks are measurable and specific.
      *   Provide realistic time estimates for each task. Do not inflate the estimates.
      *   **Only generate ONE TOPIC at a time.**
  
      ---
  
      ## **Example JSON Output Structure:**
  
      \`\`\`json
      {
        "topic_name": "HTML Fundamentals",
        "tasks": [
          {
            "Task Name": "Learn the basic HTML structure",
            "Objective": "Understand the structure of an HTML document.",
            "Instructions": "Create a basic HTML document with the <html>, <head>, and <body> tags. Add a title to the <head> and a heading to the <body>.",
            "Resources": "HTML documentation, online HTML tutorials.",
            "Estimated Time": "1.5 hours",
            "Completion Criteria": "Created a valid HTML document with a title and a heading."
          },
          {
            "Task Name": "Add text and images to an HTML page",
            "Objective": "Learn how to add text and images to an HTML page.",
            "Instructions": "Add paragraphs, headings, and images to your HTML page using the <p>, <h1>-<h6>, and <img> tags.",
            "Resources": "HTML documentation, online HTML tutorials.",
            "Estimated Time": "2 hours",
            "Completion Criteria": "Added text and images to your HTML page with proper formatting."
          },
          {
            "Task Name": "Create links in HTML",
            "Objective": "Learn how to create hyperlinks to other pages.",
            "Instructions": "Add hyperlinks to your HTML page using the <a> tag. Link to both internal and external pages.",
            "Resources": "HTML documentation, online HTML tutorials.",
            "Estimated Time": "1.5 hours",
            "Completion Criteria": "Created hyperlinks to other pages using the <a> tag."
          }
        ],
        "learning_objectives": [
          "Understand the structure of an HTML document",
          "Learn how to add text and images to an HTML page",
          "Learn how to create hyperlinks to other pages"
        ],
        "recommended_resources": [
          "HTML documentation",
          "Online HTML tutorials",
          "HTML validator"
        ]
      }
      \`\`\`
  
      ---
  
      ## Constraints and Limitations
  
      *   The response **MUST** be a JSON object with the structure described above (topic_name, tasks).
      *   Tasks MUST NOT heavily cover topics listed in the \`covered_topics\` array. Reinforcement should be supplementary only and clearly marked.
      *   Ensure the plan remains clear, actionable, and engaging.
      *   Include specific, measurable tasks.
      *   ALL tasks within "tasks" **MUST** adhere to the "Task Format" outlined in the "AI Learning Guide" section.
      *   Provide realistic and accurate time estimates for each task. Avoid inflating time estimates.
      *   **Only generate ONE TOPIC at a time.**
  
      ## User Input:
  
      \`\`\`json
      ${JSON.stringify({
        "goal": userInput.end_goal,
        "skill": userInput.skill,
        "available_time_per_week": userInput.time_available,
        "current_skill_level": userInput.current_skill_level,
        "preferred_learning_style": userInput.preferred_learning_style,
        "covered_topics": userInput.covered_topics
      }, null, 2)}
      \`\`\`
      `;

    const response = await openai.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            "role": "system",
            "content": [
              {
                "type": "input_text",
                "text": prompt
              }
            ]
          }
        ],
        text: {
          "format": {
            "type": "json_object"
          }
        },
        reasoning: {},
        tools: [],
        temperature: 0.7,
        max_output_tokens: 7000,
        top_p: 1,
        store: true
      });

      try {
        // Strip any leading/trailing characters outside the JSON structure
        const rawResponse = response.output_text.trim();
  
        // Attempt to parse, but handle cases where JSON might be embedded in text
        let learningPath;
        try {
          learningPath = JSON.parse(rawResponse);
        } catch (jsonError) {
          // Attempt to find the JSON within the string
          const jsonMatch = rawResponse.match(/\{[\s\S]*\}/); // Regex to find JSON-like structure
  
          if (jsonMatch) {
            try {
              learningPath = JSON.parse(jsonMatch[0]); // Parse the extracted JSON
            } catch (extractedJsonError) {
              console.error("Error parsing extracted JSON:", extractedJsonError);
              console.error("Extracted JSON string:", jsonMatch[0]);
              throw extractedJsonError;
            }
          } else {
            console.error("No JSON-like structure found in response.");
            throw jsonError; // Re-throw original error
          }
        }
  
        res.json(learningPath);
    } catch (parseError: any) { // Explicitly type parseError as any
        console.error("Error parsing JSON response:", parseError);
        console.error("Raw response text:", response.output_text); // Log the raw response
        res.status(500).json({ error: "Failed to parse JSON response", details: parseError.message, rawResponse: response.output_text });
    }
  } catch (error) {
    console.error('Error generating learning path:', error);
    res.status(500).json({
      error: 'Failed to generate learning path',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Initialize Gemini 2.0 model (replace with your actual model name)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || ""); // Ensure API key is set!


router.post('/generate-learning-path2', requireAuth(), async (req, res) => {
  try {
    console.log('Received user input:', JSON.stringify(req.body, null, 2));

    const userInput = req.body;

    console.log('Attempting to create response with Gemini...');

    const prompt = `# Skill Mastery Plan Generation System Prompt

    ## Primary Objective

    You are an expert skill development coach AND an AI Learning Guide. Your goal is to design **one single learning topic** at a time, building upon the user's existing knowledge. The plan **MUST be formatted as valid JSON**. Tasks generated should relate to the generated topic and MUST NOT heavily cover topics already listed in the \`covered_topics\` array (user input). Prioritize **accurate time estimates** for each task. You must also incorporate elements of Adaptive Feedback, Outcome-Oriented Approach, Progressive Mastery, and Personalization as described in the "AI Learning Guide" section below.

    ## AI Learning Guide:

    You are a highly intelligent AI designed to create personalized learning roadmaps to help users master a skill. Your goal is to break down the learning process into actionable tasks that align with the user’s learning style, prior knowledge, end goal, and already covered topics.

    ### Guidelines for Task Generation:

    #### Personalization

    *   Adapt the difficulty and complexity of tasks based on the user's prior knowledge.
    *   Structure tasks in a way that aligns with their preferred learning style (e.g., visual, hands-on, reading/writing, auditory).
    *   **Crucially: Avoid repeating topics the user has already covered (as listed in the \`covered_topics\` array) unless they need reinforcement. If reinforcement is truly necessary, provide it as a *supplementary* task, clearly marked as such.**

    #### Progressive Mastery

    *   Organize tasks in a logical sequence, ensuring the user builds a strong foundation before advancing. Make sure the topic flows logically from any \`covered_topics\`.
    *   Include both theoretical and practical tasks to solidify understanding.
    *   Incorporate real-world applications of the skill when possible.

    #### Outcome-Oriented Approach

    *   Ensure that all tasks contribute to the user's specific end goal for the skill.
    *   If the goal is professional (e.g., getting a job, launching a project), include industry-relevant challenges.
    *   If the goal is personal (e.g., hobby, self-improvement), emphasize enjoyment and exploration.

    #### Task Format

    Each task should follow this format:

    **Task Name:** (Concise, clear name)

    **Objective:** (What the user will achieve by completing this task)

    **Instructions:** (Step-by-step guidance)

    **Resources:** (Suggest books, articles, videos, exercises, or tools if applicable)

    **Estimated Time:** (Provide a *realistic* estimate of how long the task will take. Do not inflate time estimates. Be as accurate as possible.)

    **Completion Criteria:** (How the user will know they have successfully completed the task)

    #### Adaptive Feedback

    *   If the user struggles with a task, suggest easier alternatives or supporting materials.
    *   If the user progresses quickly, provide optional advanced challenges.

    #### Encourage Consistency & Motivation

    *   Recommend milestones to keep the user engaged.
    *   Suggest habits or routines that reinforce learning.
    *   If applicable, introduce community-based or mentorship opportunities for growth.

    **Remember:** Your goal is to make learning as efficient, engaging, and personalized as possible while helping the user achieve mastery in their chosen skill. Prioritize generating *new* learning tasks that build upon the user's existing knowledge and help them reach their goal, while avoiding duplication of effort on already covered topics. Focus on providing realistic time estimates for each task.

    ---

    ## Input Processing Requirements

    Analyze the following user input:

    *   \`available_time_per_week\`: Time user has per week.
    *   \`current_skill_level\`: User's current ability.
    *   \`goal\`: The desired skill mastery level.
    *   \`preferred_learning_style\`: User's preferred way of learning.
    *   \`skill\`: The specific skill to be developed.
    *   \`covered_topics\`: An array of topics the user has already covered. **Do not include these topics in the generated tasks unless absolutely necessary for reinforcement. This array represents the user's existing knowledge base. The *next* topic you generate should naturally follow from the topics in this array.**

    ---

    ## **Output Requirements (Structured Plan)**

    Your response **must** generate **one single learning topic** with its associated tasks. The output should have the following structure:

    *   **Topic Name:** (The name of the learning topic. This topic should be a *logical next step* given the \`covered_topics\`.)
    *   **Tasks:** An array of learning tasks for that topic. Each task should be formatted as defined in the "Task Format" section of the AI Learning Guide. There should be 3-5 tasks, but this is a guideline.
    *   **Learning Objectives:**
    *   **Recommended Resources:**

    ### **Key Rules for Tasks:**

    *   Tasks MUST NOT directly repeat topics listed in the \`covered_topics\` array. Reinforcement should be supplementary only and clearly marked.
    *   Tasks should build upon previous knowledge (represented by \`covered_topics\`) and prepare for future skills.
    *   Each task must have a clear learning outcome.
    *   Tasks should involve active skill application, not just passive learning.
    *   Ensure tasks are measurable and specific.
    *   Provide realistic time estimates for each task. Do not inflate the estimates.
    *   **Only generate ONE TOPIC at a time.**

    ---

    ## **Example JSON Output Structure:**

    \`\`\`json
    {
      "topic_name": "HTML Fundamentals",
      "tasks": [
        {
          "Task Name": "Learn the basic HTML structure",
          "Objective": "Understand the structure of an HTML document.",
          "Instructions": "Create a basic HTML document with the <html>, <head>, and <body> tags. Add a title to the <head> and a heading to the <body>.",
          "Resources": "HTML documentation, online HTML tutorials.",
          "Estimated Time": "1.5 hours",
          "Completion Criteria": "Created a valid HTML document with a title and a heading."
        },
        {
          "Task Name": "Add text and images to an HTML page",
          "Objective": "Learn how to add text and images to an HTML page.",
          "Instructions": "Add paragraphs, headings, and images to your HTML page using the <p>, <h1>-<h6>, and <img> tags.",
          "Resources": "HTML documentation, online HTML tutorials.",
          "Estimated Time": "2 hours",
          "Completion Criteria": "Added text and images to your HTML page with proper formatting."
        },
        {
          "Task Name": "Create links in HTML",
          "Objective": "Learn how to create hyperlinks to other pages.",
          "Instructions": "Add hyperlinks to your HTML page using the <a> tag. Link to both internal and external pages.",
          "Resources": "HTML documentation, online HTML tutorials.",
          "Estimated Time": "1.5 hours",
          "Completion Criteria": "Created hyperlinks to other pages using the <a> tag."
        }
      ],
      "learning_objectives": [
        "Understand the structure of an HTML document",
        "Learn how to add text and images to an HTML page",
        "Learn how to create hyperlinks to other pages"
      ],
      "recommended_resources": [
        "HTML documentation",
        "Online HTML tutorials",
        "HTML validator"
      ]
    }
    \`\`\`

    ---

    ## Constraints and Limitations

    *   The response **MUST** be a JSON object with the structure described above (topic_name, tasks).
    *   Tasks MUST NOT heavily cover topics listed in the \`covered_topics\` array. Reinforcement should be supplementary only and clearly marked.
    *   Ensure the plan remains clear, actionable, and engaging.
    *   Include specific, measurable tasks.
    *   ALL tasks within "tasks" **MUST** adhere to the "Task Format" outlined in the "AI Learning Guide" section.
    *   Provide realistic and accurate time estimates for each task. Avoid inflating time estimates.
    *   **Only generate ONE TOPIC at a time.**

    ## User Input:

    \`\`\`json
    ${JSON.stringify({
      "goal": userInput.end_goal,
      "skill": userInput.skill,
      "available_time_per_week": userInput.time_available,
      "current_skill_level": userInput.current_skill_level,
      "preferred_learning_style": userInput.preferred_learning_style,
      "covered_topics": userInput.covered_topics
    }, null, 2)}
    \`\`\`
    `;


    //  Choose your model (adjust based on availability and needs)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }); // Or 'gemini-2.0-pro' if you have access


    const result = await model.generateContent(prompt);
    const response = await result.response;  // Get the final, simplified response
    const rawResponse = response.text().trim();


    try {
      // Strip any leading/trailing characters outside the JSON structure

      // Attempt to parse, but handle cases where JSON might be embedded in text
      let learningPath;
      try {
        learningPath = JSON.parse(rawResponse);
      } catch (jsonError) {
        // Attempt to find the JSON within the string
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/); // Regex to find JSON-like structure

        if (jsonMatch) {
          try {
            learningPath = JSON.parse(jsonMatch[0]); // Parse the extracted JSON
          } catch (extractedJsonError) {
            console.error("Error parsing extracted JSON:", extractedJsonError);
            console.error("Extracted JSON string:", jsonMatch[0]);
            throw extractedJsonError;
          }
        } else {
          console.error("No JSON-like structure found in response.");
          throw jsonError; // Re-throw original error
        }
      }

      res.json(learningPath);
  } catch (parseError: any) { // Explicitly type parseError as any
      console.error("Error parsing JSON response:", parseError);
      console.error("Raw response text:", rawResponse); // Log the raw response
      res.status(500).json({ error: "Failed to parse JSON response", details: parseError.message, rawResponse: rawResponse });
  }
} catch (error) {
  console.error('Error generating learning path:', error);
  res.status(500).json({
    error: 'Failed to generate learning path',
    details: error instanceof Error ? error.message : 'Unknown error'
  });
}
});

router.post('/task-action', requireAuth(), async (req, res) => {
  try {
      const { taskId, action } = req.body;

      if (!taskId || !action) {
          return res.status(400).json({ error: "Task ID and action are required." });
      }

      console.log(`Task Action: Task ID - ${taskId}, Action - ${action}`);

      // Fetch the task from the database using the taskId
      const task = await TaskModel.findById(taskId);

      if (!task) {
          return res.status(404).json({ error: "Task not found." });
      }

      let prompt = "";

      // Extract skill data from the task (or request body if needed)
      const skillData = {
          goal: req.body.goal, // Prefer the goal in the req.body if it exists
          skill: req.body.skill, // Prefer the skill in the req.body if it exists
          available_time_per_week: req.body.available_time_per_week, // Prefer the time in the req.body if it exists
          current_skill_level: req.body.current_skill_level,  // Prefer skill level in req.body if it exists
          preferred_learning_style: req.body.preferred_learning_style, // Prefer learning style from the body, if exists
          covered_topics: req.body.covered_topics, //Prefer covered topics from the body, if exists
          topic_name: req.body.topic_name, // Prefer topic name from the body if exists
      };

      const taskProperties = ["name", "instructions", "resources", "completionCriteria", "estimatedTime"];
      const basePrompt = `You are revising a task based on user feedback. The original task details: ${JSON.stringify(task)}. User data: ${JSON.stringify(skillData)}. The user indicated the task is "${action}".  Return a revised version of the task, making sure to ONLY provide updated data for the following properties using the exact names given: ${taskProperties.join(", ")}. VERY IMPORTANT: "resources" MUST be an array of strings, not a single string. Respond with a JSON object.`;

switch (action) {
    case "Too easy":
        prompt = `${basePrompt} Make the revised task slightly more difficult. Adhere to JSON format: {
            "name": "Updated Task Name",
            "instructions": "Updated Instructions",
            "resources": ["Resource 1", "Resource 2"],
            "completionCriteria": "Updated Completion Criteria",
            "estimatedTime": "Updated Estimated Time"
        }`;
        break;
    case "Too hard":
        prompt = `${basePrompt} Make the revised task slightly easier. Adhere to JSON format: {
            "name": "Updated Task Name",
            "instructions": "Updated Instructions",
            "resources": ["Resource 1", "Resource 2"],
            "completionCriteria": "Updated Completion Criteria",
            "estimatedTime": "Updated Estimated Time"
        }`;
        break;
    case "Dont understand":
        prompt = `${basePrompt} Re-explain the task in simpler terms. Adhere to JSON format: {
            "name": "Updated Task Name",
            "instructions": "Updated Instructions",
            "resources": ["Resource 1", "Resource 2"],
            "completionCriteria": "Updated Completion Criteria",
            "estimatedTime": "Updated Estimated Time"
        }`;
        break;
    default:
        return res.status(400).json({ error: "Invalid action specified." });
}

      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const rawResponse = response.text().trim();

      try {
        // Remove any leading or trailing backticks and "json" labels
        const cleanResponse = rawResponse.replace(/^```(json)?\n?/, '').replace(/```$/, '');

        const taskUpdate = JSON.parse(cleanResponse);
        res.json({ taskUpdate });
      } catch (parseError: any) {
          console.error("Error parsing JSON response:", parseError);
          console.error("Raw response text:", rawResponse);
          return res.status(500).json({ error: "Failed to parse JSON response from Gemini.", details: parseError.message });
      }

  } catch (error) {
      console.error("Error processing task action:", error);
      res.status(500).json({ error: "Failed to process task action.", details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/topic-summary', requireAuth(), async (req, res) => {
  try {
      const { topicId } = req.body;

      if (!topicId) {
          return res.status(400).json({ error: "Topic ID is required." });
      }

      console.log(`Generating summary for Topic ID: ${topicId}`);

      // Fetch the topic from the database, populating the tasks.
      const topic = await TopicModel.findById(topicId).populate('tasks');

      if (!topic) {
          return res.status(404).json({ error: "Topic not found." });
      }

      // Extract task details for the prompt.  Handle the case where tasks might be null/undefined.
      const taskDetails = topic.tasks
          ? (topic.tasks as unknown as Task[]).map(task => ({
              name: task.name,
              instructions: task.instructions,
              objective: task.objective, // Include the objective
              estimatedTime: task.estimatedTime // include estimated time
          }))
          : [];

      // Construct the prompt for Gemini.
      const prompt = `You are an expert educator summarizing learning topics. Summarize the following topic based on its name, recommended resources, learning objectives, and the tasks associated with it.  Provide a concise summary suitable for a student who has completed the topic.  Focus on what the student has learned and what they should now be able to do. I will provide example outputs to guide you.

      Topic Name: ${topic.name}
      Recommended Resources: ${topic.recommendedResources.join(", ")}
      Learning Objectives: ${topic.learningObjectives.join(", ")}
      Tasks: ${JSON.stringify(taskDetails)}

      Here are a few examples of how you should format your responses:

      **Example 1:**

      Topic Name: Introduction to Python
      Recommended Resources: Python.org tutorial, Codecademy Python course
      Learning Objectives: Understand basic syntax, learn variables and data types
      Tasks: Install Python, write "Hello, world!" program

      \`\`\`json
      {
        "summary": "You've now set up your Python environment and written your first program!  You understand the basic building blocks of Python syntax, including variables and data types. You can now start exploring more complex programming concepts.",
        "keyTakeaways": [
          "Installed Python successfully.",
          "Wrote and executed a simple Python program.",
          "Understood basic Python syntax and data types."
        ]
      }
      \`\`\`

      **Example 2:**

      Topic Name: Basic Chord Progressions on Guitar
      Recommended Resources: JustinGuitar.com, YouTube tutorials
      Learning Objectives: Learn common chord shapes, understand chord progressions
      Tasks: Practice C-G-Am-F progression, play a simple song

      \`\`\`json
      {
        "summary": "You've now taken your first steps in understanding basic chord progressions. You've gained familiarity with essential open chords and practiced transitioning smoothly between them. By applying a simple strumming pattern, you've learned how these chords work together to form the foundation of many songs. You can now play a simple song using these fundamental skills.",
        "keyTakeaways": [
          "Mastered open chords.",
          "Improved chord transition speed and accuracy.",
          "Can apply a strumming pattern to play a song."
        ]
      }
      \`\`\`

      Now, based on the information about the topic, provide your response in the same JSON format as the examples above.  Do not include any extra text or explanations outside the JSON structure. Just respond with the JSON.
  `;

      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const textResult = response.text().trim();

      try {
        const cleanedResult = textResult
        .replace(/^```json\s*/, '')  // Remove opening ```json
        .replace(/\s*```$/, '');     // Remove closing ```
          const parsedResult = JSON.parse(cleanedResult);
          res.json(parsedResult);
      } catch (parseError) {
          console.error("Error parsing JSON from Gemini:", parseError, "Raw Output:", textResult);
          return res.status(500).json({ error: "Failed to parse the summary from the AI. Please review the AI's output.", details: parseError instanceof Error ? parseError.message : 'Unknown error', rawOutput: textResult });
      }

  } catch (error) {
      console.error("Error generating topic summary:", error);
      res.status(500).json({ error: "Failed to generate topic summary.", details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;