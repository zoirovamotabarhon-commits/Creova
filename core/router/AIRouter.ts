    return {
      content:
        hybrid.content,

      model:
        hybrid.model ??
        "creova-hybrid",

      generationId:
        hybrid.routedTo === "local"
          ? "local"
          : "hybrid-cloud",

      routedTo:
        hybrid.routedTo ===
        "local"
          ? "local"
          : "cloud",
    };
  }
}
