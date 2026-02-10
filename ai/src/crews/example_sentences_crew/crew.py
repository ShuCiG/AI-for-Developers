from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from typing import List
from src.crews.base.llm import DEFAULT_LLM
from src.crews.example_sentences_crew.schemas import ExampleSentencesOutput

@CrewBase
class ExampleSentencesCrew():
    agents: List[BaseAgent]
    tasks: List[Task]

    @agent
    def sentence_generator(self) -> Agent:
        return Agent(
            config=self.agents_config['sentence_generator'],
            llm=DEFAULT_LLM
        )

    @task
    def sentence_generation_task(self) -> Task:
        return Task(
            config=self.tasks_config['sentence_generation_task'],
            output_pydantic=ExampleSentencesOutput
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential
        )