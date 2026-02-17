from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from typing import List
from src.crews.base.llm import DEFAULT_LLM
from src.crews.translation_crew.schemas import TranslationOutput


@CrewBase
class TranslationCrew:
    agents: List[BaseAgent]
    tasks: List[Task]
    
    def __init__(self, user_id: str):
        """
        Initialize TranslationCrew with user context for tools.
        
        Args:
            user_id: The user's UUID (needed for save_word_pair tool)
        """
        super().__init__()
        self.user_id = user_id
    
    @agent
    def translation_agent(self) -> Agent:
        """Create the translation agent with save_word_pair tool."""
        from src.tools.save_word_pair_tool import SaveWordPairTool
        
        # Initialize tool with user_id
        save_tool = SaveWordPairTool(user_id=self.user_id)
        
        return Agent(
            config=self.agents_config["translation_agent"],
            llm=DEFAULT_LLM,
            tools=[save_tool],
            verbose=True
        )
    
    @task
    def translation_task(self) -> Task:
        """Create the translation task."""
        return Task(
            config=self.tasks_config["translation_task"],
            output_pydantic=TranslationOutput
        )
    
    @crew
    def crew(self) -> Crew:
        """Create and return the crew."""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True
        )
