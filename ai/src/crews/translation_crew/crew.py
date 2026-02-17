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

    @agent
    def translator(self) -> Agent:
        return Agent(
            config=self.agents_config["translator"],
            llm=DEFAULT_LLM,
        )

    @task
    def translation_task(self) -> Task:
        return Task(
            config=self.tasks_config["translation_task"],
            output_pydantic=TranslationOutput,
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
        )
