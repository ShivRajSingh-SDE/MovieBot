const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const winston = require("winston");

// Replace with your Telegram bot token and TMDb API key
const token = "7339610021:AAHHamo3atq1x-LU94FW34gF8azRTphzKQk";
// const token = "6373118547:AAFkhRu9WJiGYIzrMfDPQ_ykyd3khPpbfWk";
const apiKey = "0012f8a0bc0326403fdade4bd5cd5e92";

// Configure logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "bot.log" }),
  ],
});

const joinGroupUrl = "https://t.me/+sw5sMsO38WJmYmZl";

// Helper function to send messages with the join group button
const sendMessageWithJoinGroupButton = async (chatId, text, options = {}) => {
  await bot.sendMessage(chatId, text, {
    ...options,
    reply_markup: {
      inline_keyboard: [
        ...(options.reply_markup?.inline_keyboard || []),
        [{ text: "Join Our Main Group", url: joinGroupUrl }],
      ],
    },
  });
};

// Function to generate streaming URLs using the provided ID
const videoSources = {
  autoembed: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
  download: (id) => `https://dl.vidsrc.vip/movie/${id}`,
  trailer: (id) =>
    `https://api.themoviedb.org/3/movie/${id}/videos?api_key=${apiKey}&language=en-US`,
};

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });
// In-memory usage tracking
const userUsageCount = {};

const incrementUsageCount = (userId) => {
  if (!userUsageCount[userId]) {
    userUsageCount[userId] = 1;
  } else {
    userUsageCount[userId]++;
  }
  return userUsageCount[userId];
};

const searchMovieByName = async (movieTitle) => {
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(
        movieTitle
      )}&language=en-US&page=1&include_adult=false`
    );
    return response.data.results;
  } catch (error) {
    logger.error("Failed to search movie by name", { error });
    throw new Error("Failed to search movie by name");
  }
};

// Function to fetch movie details
const fetchMovieDetails = async (movieId) => {
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}&language=en-US`
    );
    return response.data;
  } catch (error) {
    logger.error("Failed to fetch movie details", { error });
    throw new Error("Failed to fetch movie details");
  }
};

// Function to fetch movie details by title
const fetchMovieDetailsByTitle = async (movieTitle) => {
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(
        movieTitle
      )}&language=en-US&page=1&include_adult=false`
    );
    return response.data.results;
  } catch (error) {
    console.error("Error fetching movie data:", error.message);
    return [];
  }
};

// Function to fetch movie trailer
const fetchMovieTrailer = async (movieId) => {
  try {
    const response = await axios.get(videoSources.trailer(movieId));
    const trailers = response.data.results.filter(
      (video) => video.type === "Trailer"
    );
    return trailers.length > 0
      ? `https://www.youtube.com/watch?v=${trailers[0].key}`
      : null;
  } catch (error) {
    logger.error("Failed to fetch movie trailer", { error });
    return null;
  }
};

// Function to escape Markdown special characters
const escapeMarkdown = (text) => {
  return text.replace(/([_*[\]()~`>#+-=|{}.!])/, "\\$1");
};

bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id;
  const username = msg.from.username ? `@${msg.from.username}` : "there"; // Get username, or default to 'there' if not set

  // Increment user usage count
  const usageCount = incrementUsageCount(userId);

  const welcomeMessage = `🎬 *Welcome to the Movie Bot* \n\nHello ${username} (ID: ${userId}),\n\nYou have used this bot *${usageCount} times*.\n\nYou can search for a movie by typing its name. For example, send "Inception". \n\n🌟 Happy Watching! 🌟\n\n*Note: After payment, send Screenshot to @luffythegod*`;

  bot.sendMessage(msg.chat.id, welcomeMessage, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "⚡⚡ Join Main Channel ⚡⚡",
            url: joinGroupUrl,
          },
        ],
        [
          {
            text: "❤️ Donate to Support Us",
            url: "https://razorpay.me/@toolzstream",
          },
          { text: "🔗 Share", switch_inline_query: "Check out this movie!" },
        ],
        [{ text: "🔒 Premium Subscription", url: "https://rzp.io/i/WciMFL1X" }],
        [
          { text: "🌐 Change Language", callback_data: "change_language" },
          { text: "👤 My Profile", callback_data: "my_profile" },
        ],
        [
          {
            text: "🔞 Adult 18+ Content",
            callback_data: "adult_content",
          },
          {
            text: "↩️ Return",
            callback_data: "return_main",
          },
        ],
        [{ text: "❤️💕 OTTS Super Sale💕❤️", url: `https://toolzstream.me` }],
      ],
    },
  });
});

// Handle movie search and inline search
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text && !text.startsWith("/")) {
    // Check rate limiting
    if (isRateLimited(chatId)) {
      bot.sendMessage(
        chatId,
        "You're sending requests too quickly. Please wait a moment."
      );
      return;
    }

    // Search for movies by title
    try {
      const movies = await fetchMovieDetailsByTitle(text);

      if (movies.length > 0) {
        const movieButtons = [];

        // Loop through each movie and generate buttons for all parts
        for (const movie of movies) {
          const movieTitle = escapeMarkdown(movie.title);
          const releaseDate = movie.release_date
            ? movie.release_date.split("-")[0]
            : "N/A";
          const streamingUrl = videoSources.autoembed(movie.id);
          const downloadUrl = videoSources.download(movie.id);
          const trailerUrl = await fetchMovieTrailer(movie.id);

          // Push button for each movie part
          movieButtons.push([
            {
              text: `${movieTitle} (${releaseDate})`,
              callback_data: `play_${movie.id}`,
            },
          ]);
        }

        // Send a message with buttons for all movie parts
        bot.sendMessage(chatId, "Select a part of the movie:", {
          reply_markup: {
            inline_keyboard: movieButtons,
          },
        });
      } else {
        bot.sendMessage(
          chatId,
          "No movie found with that name. Please try another."
        );
      }
    } catch (error) {
      logger.error("Error fetching movie data", { error });
      bot.sendMessage(
        chatId,
        "An error occurred while searching for the movie. Please try again later."
      );
    }
  }
});

// Handle the /play command to provide a direct streaming link and detailed movie information
bot.onText(/\/play (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const movieName = match[1].trim(); // Get the movie name from the message

  try {
    // Search for the movie by name using your movie search API (e.g., TMDb)
    const movieSearchResults = await searchMovieByName(movieName);

    if (!movieSearchResults || movieSearchResults.length === 0) {
      // No results found
      return bot.sendMessage(
        chatId,
        `No movies found for "${movieName}". Please try a different title.`
      );
    }

    // Take the first result as the best match
    const movie = movieSearchResults[0];
    const movieId = movie.id;

    // Fetch movie details and trailer
    const movieDetails = await fetchMovieDetails(movieId);
    const trailerUrl = await fetchMovieTrailer(movieId);

    // Generate streaming and download URLs
    const streamingUrl = videoSources.autoembed(movieId);
    const downloadUrl = videoSources.download(movieId);

    // Construct movie information message
    const movieInfo = `
*${escapeMarkdown(movieDetails.title)}* (${movieDetails.release_date})

*Overview:* ${escapeMarkdown(movieDetails.overview)}

*Language:* MultiDubbed

*Genres:* ${movieDetails.genres
      .map((genre) => escapeMarkdown(genre.name))
      .join(", ")}

⭐️ *Rating:* ${movieDetails.vote_average} / 10
`;

    // Send the movie poster and details with a "Click to Watch" button
    const posterUrl = `https://image.tmdb.org/t/p/w500${movieDetails.poster_path}`;
    await bot.sendPhoto(chatId, posterUrl, {
      caption: movieInfo,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🎥 Watch the Trailer",
              url: trailerUrl || "https://www.youtube.com", // Fallback link
            },
            {
              text: "🎥 Click To Watch",
              callback_data: `wait_${movieId}`, // Button to start countdown
            },
          ],
          [
            {
              text: "⚡⚡JoIN The Mine Group⚡⚡",
              url: joinGroupUrl,
            },
          ],
        ],
      },
    });
  } catch (error) {
    logger.error("Error fetching movie data or generating link", { error });
    bot.sendMessage(
      chatId,
      "An error occurred while fetching the movie details or generating the streaming link. Please try again later."
    );
  }
});

// User activity tracking
const userActivity = {};

// Rate limiting
const isRateLimited = (userId) => {
  const now = Date.now();
  if (userActivity[userId] && now - userActivity[userId] < 5000) {
    return true;
  }
  userActivity[userId] = now;
  return false;
};

// Handle callback queries when the user clicks the inline button
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const movieId = query.data.split("_")[1];
  const username = query.from.username ? `@${query.from.username}` : "there";

  if (query.data === "adult_content") {
    bot.sendMessage(
      chatId,
      "🔞 *Adult Content Disclaimer*\n\nYou are about to access adult 18+ content. Do you wish to proceed?",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔞 Yes, I'm 18+", callback_data: "confirm_adult" },
              { text: "🚫 No, Take Me Back", callback_data: "return_main" },
            ],
            [
              {
                text: "⚡⚡JoIN For More⚡⚡",
                url: joinGroupUrl,
              },
            ],
          ],
        },
      }
    );
  }

  if (query.data === "confirm_adult") {
    bot.sendMessage(
      chatId,
      "🔞 *Access granted!* \n\nSearching for adult content... 💋💦"
    );

    const adultContentLinks = `
  *Here are some curated links for you:*
  
  1. 🌐 [SexDate](https://enjoyxxx.club/xdating) - Find your date 😈
  2. 🌐 [XDate](https://enjoyxxx.club/casual) - Casual encounters 😉
  3. 🌐 [StripChat](https://enjoyxxx.club/cams) - Live cam shows 💃
  4. 🌐 [Gays](https://t.me/gaypornmovi) - Gay content 🌈
  5. 🌐 [Lesbian](https://t.me/lesbianpornhq) - Lesbian content 💋
  6. 🌐 [Trans](https://t.me/tgirlsmovies) - Transgender content 💖
  7. 🌐 [Bi Empire](https://t.me/biempirehub) - Bisexual content 🏳️‍🌈
  8. 🌐 [XVideo](https://t.me/pornhubox) - Popular videos 🍑
  9. 🌐 [Japanese Porn](https://t.me/japaneseporh) - Japanese adult content 🍑
  10. 🌐 [PornGames](https://t.me/porndolls) - Adult games 🎮
  11. 🌐 [Hentai Porn](https://t.me/hentaihavenhq) - Hentai content 🍆
  11. 🌐 [MMS Viral Videos](https://t.me/franchulamannaa) - Viral content 🍆
    `;

    bot.sendMessage(chatId, adultContentLinks, { parse_mode: "Markdown" });
  }

  if (query.data === "return_main") {
    bot.sendMessage(chatId, "🔙 *Returning to the main menu...*");
    // You can resend the main menu here or handle the return logic
  }

  if (query.data === "my_profile") {
    bot.sendMessage(
      chatId,
      `👤 *Your Profile Information:*\n\n*Username:* ${username}\n*User ID:* ${userId}`,
      {
        parse_mode: "Markdown",
      }
    );
  }

  if (query.data === "change_language") {
    bot.sendMessage(
      chatId,
      `👤 *Thanks For Support *\n\n*Username:* ${username}\n*User ID:* ${userId} \n \n This feature will be added soon.`,
      {
        parse_mode: "Markdown",
      }
    );
  }

  if (query.data.startsWith("play")) {
    if (isRateLimited(userId)) {
      bot.answerCallbackQuery(query.id, {
        text: "You're clicking too fast. Please wait a moment.",
      });
      return;
    }

    try {
      const movie = await fetchMovieDetails(movieId);
      const trailerUrl = await fetchMovieTrailer(movieId);

      // Generate streaming and download URLs
      const streamingUrl = videoSources.autoembed(movieId);
      const downloadUrl = videoSources.download(movieId);

      // Construct movie information message
      const movieInfo = `
*${escapeMarkdown(movie.title)}* (${movie.release_date})

*Overview:* ${escapeMarkdown(movie.overview)}

*Language:* MultiDubbed

*Genres:* ${movie.genres.map((genre) => escapeMarkdown(genre.name)).join(", ")}

⭐️ *Rating:* ${movie.vote_average} / 10
`;

      // Send the movie poster and details with a "Click to Watch" button
      const posterUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
      await bot.sendPhoto(chatId, posterUrl, {
        caption: movieInfo,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🎥 Watch the Trailer",
                url: trailerUrl || "https://www.youtube.com", // Fallback link
              },
              {
                text: "🎥 Click To Watch",
                callback_data: `wait_${movieId}`, // Button to start countdown
              },
            ],
            [
              {
                text: "⚡⚡JoIN The Mine Group⚡⚡",
                url: joinGroupUrl,
              },
            ],
          ],
        },
      });

      bot.answerCallbackQuery(query.id);
    } catch (error) {
      logger.error("Error fetching movie data or generating link", { error });
      bot.sendMessage(
        chatId,
        "An error occurred while fetching the movie details or generating the streaming link. Please try again later."
      );
    }
  } else if (query.data.startsWith("wait")) {
    // Countdown logic when user clicks "Click To Watch"
    let secondsLeft = 5;
    const countdownMessage = await bot.sendMessage(
      chatId,
      `Please wait for ${secondsLeft} seconds...`
    );

    const timerInterval = setInterval(async () => {
      secondsLeft -= 1;

      // Update countdown message
      bot.editMessageText(`Please wait for ${secondsLeft} seconds...`, {
        chat_id: chatId,
        message_id: countdownMessage.message_id,
      });

      // After 5 seconds, send the streaming and download links
      if (secondsLeft <= 0) {
        clearInterval(timerInterval);

        bot.editMessageText(`Here are your movie links:`, {
          chat_id: chatId,
          message_id: countdownMessage.message_id,
        });

        const movie = await fetchMovieDetails(movieId);
        const streamingUrl = videoSources.autoembed(movieId);
        const downloadUrl = videoSources.download(movieId);

        // Send the final message with bigger buttons and additional options
        await bot.sendMessage(
          chatId,
          `*${movie.title}* (${movie.release_date})\n\n*Overview:* ${movie.overview}\n\n🎥 [Watch the Movie](${streamingUrl})\n⬇️ [Download the Movie](${downloadUrl})`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "⚡⚡JoIN The Mine Group⚡⚡",
                    url: joinGroupUrl,
                  },
                ],
                [
                  {
                    text: "🎥 Watch the Movie",
                    url: streamingUrl, // Direct link to play the movie
                  },
                  {
                    text: "⬇️ Download the Movie",
                    url: downloadUrl, // Direct link to download the movie
                  },
                ],
                [
                  {
                    text: "❤️ Donate to Support Us",
                    url: "https://razorpay.me/@toolzstream", // Razorpay donate link
                  },
                  {
                    text: "🔗 Share",
                    switch_inline_query: `Check out this movie: ${movie.title} (${movie.release_date})!`, // Share option to send movie details
                  },
                ],
              ],
            },
          }
        );
      }
    }, 1000); // Update every second
  }
});

console.log("Server running and bot started!");
