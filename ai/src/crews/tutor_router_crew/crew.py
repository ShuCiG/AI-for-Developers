from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from typing import List

from src.crews.base.llm import DEFAULT_LLM
from src.crews.tutor_router_crew.schemas import RouterOutput


@CrewBase
class TutorRouterCrew:
    agents: List[BaseAgent]
    tasks: List[Task]

    @agent
    def tutor_router(self) -> Agent:
        return Agent(
            config=self.agents_config["tutor_router"],
            llm=DEFAULT_LLM,
        )

    @task
    def router_task(self) -> Task:
        return Task(
            config=self.tasks_config["router_task"],
            output_pydantic=RouterOutput,
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
        )
