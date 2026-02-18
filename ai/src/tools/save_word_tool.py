"""
CrewAI tool for saving individual words to the user's word list.
"""
from typing import Type
from pydantic import BaseModel, Field
from crewai.tools import BaseTool
from src.tools.save_word_handler import save_word_handler


class SaveWordToolInput(BaseModel):
    """Input schema for save_word tool."""
    word: str = Field(..., description="The word to save")


class SaveWordTool(BaseTool):
    """
    Tool for saving individual words to the user's personal word list.
    
    Use this tool when the user asks to save a new word they've learned,
    or when you've taught them a new word and want to offer saving it.
    The tool checks for duplicates automatically and provides clear feedback.
    """
    name: str = "save_word"
    description: str = (
        "Save a single word to the user's personal word list "
        "for future practice. Use this tool when the user explicitly asks to save "
        "a new word, or proactively offer to save new words you've taught them. "
        "The tool automatically checks for duplicates (case-insensitive)."
    )
    args_schema: Type[BaseModel] = SaveWordToolInput
    
    def __init__(self, user_id: str, **kwargs):
        """
        Initialize the tool with user context.
        
        Args:
            user_id: The user's UUID (passed from crew inputs)
        """
        super().__init__(**kwargs)
        # Store user_id as instance attribute (not a Pydantic field)
        object.__setattr__(self, '_user_id', user_id)
    
    @property
    def user_id(self) -> str:
        """Get the user ID."""
        return getattr(self, '_user_id', '')
    
    def _run(
        self,
        word: str
    ) -> str:
        """
        Execute the tool synchronously.
        
        Note: CrewAI tools can be async, but BaseTool._run is sync.
        We'll use asyncio.run for the async handler.
        """
        import asyncio
        try:
            # Run the async handler
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            if loop.is_running():
                # If we're already in an async context, we need to handle it differently
                # Create a new event loop in a thread
                import concurrent.futures
                import threading
                
                def run_in_thread():
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    try:
                        return new_loop.run_until_complete(
                            save_word_handler(self.user_id, word)
                        )
                    finally:
                        new_loop.close()
                
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(run_in_thread)
                    result = future.result(timeout=10)
            else:
                result = loop.run_until_complete(
                    save_word_handler(self.user_id, word)
                )
            
            # Return a user-friendly message
            if result.get("success"):
                return result["message"]
            else:
                return f"Could not save word: {result['message']}"
                
        except Exception as e:
            return f"Error executing save_word tool: {str(e)}"
    
    async def _arun(
        self,
        word: str
    ) -> str:
        """
        Execute the tool asynchronously (preferred for async contexts).
        """
        try:
            result = await save_word_handler(
                self.user_id,
                word
            )
            
            if result.get("success"):
                return result["message"]
            else:
                return f"Could not save word: {result['message']}"
                
        except Exception as e:
            return f"Error executing save_word tool: {str(e)}"
